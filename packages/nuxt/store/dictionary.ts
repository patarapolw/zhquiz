import S from 'jsonschema-definer'
import Loki from 'lokijs'
// @ts-ignore
import LokiIndexedAdapter from 'lokijs/src/loki-indexed-adapter'
import { actionTree, mutationTree } from 'typed-vuex'
import XRegExp from 'xregexp'

import { ensureSchema, IDictionaryType, sDictionaryType } from '~/assets/schema'

/**
 * All fields, if fetched, are not undefined.
 */
const sDictionary = S.shape({
  type: sDictionaryType,
  entry: S.string(),
  alt: S.list(S.string()).optional(),
  reading: S.list(S.string()).optional(),
  english: S.list(S.string()).optional(),
  /**
   * @default undefined
   */
  frequency: S.number().optional(),
})

export type IDictionary = typeof sDictionary.type

const sToken = S.shape({
  entry: S.string(),
  sub: S.list(S.string()).minItems(1).optional(),
  sup: S.list(S.string()).minItems(1).optional(),
  variants: S.list(S.string()).minItems(1).optional(),
})

export type IToken = typeof sToken.type

export const state = () => ({
  zh: null as Loki | null,
  zhToken: null as Collection<IToken> | null,
  zhDict: null as Collection<IDictionary> | null,
  // pending: {
  //   token: new Set<string>(),
  //   dict: new Map<string, Set<string>>(),
  // },
})

export const mutations = mutationTree(state, {
  INIT(
    state,
    {
      zh,
      zhToken,
      zhDict,
    }: {
      zh: Loki
      zhToken: Collection<IToken>
      zhDict: Collection<IDictionary>
    }
  ) {
    state.zh = zh
    state.zhToken = zhToken
    state.zhDict = zhDict
  },
})

export const actions = actionTree(
  { state, mutations },
  {
    async init({ commit }) {
      await new Promise((resolve) => {
        const zh = new Loki('zh.loki', {
          adapter: new LokiIndexedAdapter(),
          // adapter: new Loki.LokiPartitioningAdapter(new LokiIndexedAdapter(), {
          //   paging: true,
          // }),
          autoload: true,
          autoloadCallback: async () => {
            let zhToken = zh.getCollection<IToken>('token')
            if (!zhToken) {
              zhToken = zh.addCollection('token', {
                unique: ['entry'],
              })
            }

            let zhDict = zh.getCollection<IDictionary>('dictionary')
            if (!zhDict) {
              zhDict = zh.addCollection('dictionary', {
                indices: ['entry', 'type'],
              })
            }

            commit('INIT', { zh, zhToken, zhDict })
            resolve()
          },
          autosave: true,
          autosaveInterval: 4000,
        })
      })
    },
    async searchToken(
      { state },
      {
        q,
      }: {
        q: string
      }
    ): Promise<
      {
        entry: string
        sub?: string[]
        sup?: string[]
        variants?: string[]
      }[]
    > {
      const qs = (q.match(XRegExp('\\p{Han}')) || []).filter(
        (h, i, arr) => arr.indexOf(h) === i
      )

      if (!qs.length) {
        return []
      }

      const exclude: string[] = []

      if (state.zhToken) {
        state.zhToken.find({ entry: { $in: qs } }).map((o) => {
          exclude.push(o.entry)
        })
      }

      const result = (
        await this.$axios.$get('/api/token/q', {
          params: {
            q: qs.join(''),
            exclude: exclude.join('') || undefined,
          },
        })
      ).result as {
        entry: string
        sub?: string[]
        sup?: string[]
        variants?: string[]
      }[]

      if (state.zhToken) {
        const uMap = result.reduce(
          (prev, r) => {
            prev.set(r.entry, r)
            return prev
          },
          new Map<
            string,
            {
              entry: string
              sub?: string[]
              sup?: string[]
              variants?: string[]
            }
          >()
        )

        const newItems = new Set(qs)
        state.zhToken.updateWhere(
          (o) => newItems.has(o.entry),
          (o) => {
            newItems.delete(o.entry)
            const u = uMap.get(o.entry)
            if (u) {
              return ensureSchema(sToken, Object.assign(o, u))
            }

            return o
          }
        )
        state.zhToken.insert(
          Array.from(newItems).map((entry) => {
            return ensureSchema(
              sToken,
              Object.assign({ entry }, uMap.get(entry) || {})
            )
          })
        )

        return state.zhToken
          .find({
            entry: { $in: qs },
          })
          .map(({ entry, sub, sup, variants }) => ({
            entry,
            sub,
            sup,
            variants,
          }))
      }

      return result
    },
    async searchDict(
      { state },
      {
        strategy,
        q,
        type,
        select = ['entry', 'alt', 'reading', 'english'],
        limit = 10,
      }: {
        strategy: 'match' | 'alt' | 'contains'
        q?: string
        type: IDictionaryType
        select?: ('entry' | 'alt' | 'reading' | 'english')[]
        limit?: number
      }
    ): Promise<Partial<IDictionary>[]> {
      const qs = (q || '')
        .split(' ')
        .filter((h, i, arr) => arr.indexOf(h) === i)

      if (!qs.length) {
        return []
      }
      const existing: string[] = []
      const cond = {
        $and: [
          select.reduce(
            (prev, k) => ({ ...prev, [k]: { $exists: true } }),
            {} as any
          ),
          { type },
          ...(q && strategy === 'contains'
            ? [
                {
                  $or: [
                    { entry: { $containsString: q } },
                    { alt: { $containsString: q } },
                  ],
                },
              ]
            : []),
          ...(qs.length
            ? strategy === 'match'
              ? [{ entry: { $in: qs } }]
              : strategy === 'alt'
              ? [{ $or: [{ entry: { $in: qs } }, { alt: { $in: qs } }] }]
              : []
            : []),
        ],
      }

      if (state.zhDict) {
        state.zhDict.find(cond).map((o) => {
          existing.push(o.entry)
        })
      }

      const { result } = (await this.$axios.$post('/api/dictionary/q', {
        strategy,
        q,
        type,
        select: [...new Set([...select, 'entry', 'frequency'])],
        limit,
        exclude: existing,
      })) as {
        result: (Partial<IDictionary> &
          Pick<IDictionary, 'entry' | 'frequency'>)[]
      }

      if (state.zhDict) {
        const uMap = result.reduce((prev, r) => {
          prev.set(r.entry, {
            ...r,
            type,
          })
          return prev
        }, new Map<string, Partial<IDictionary> & Pick<IDictionary, 'entry' | 'frequency' | 'type'>>())

        const newItems = new Set(uMap.keys())
        state.zhDict.updateWhere(
          (o) => newItems.has(o.entry),
          (o) => {
            newItems.delete(o.entry)
            const u = uMap.get(o.entry)
            if (u) {
              return ensureSchema(sDictionary, Object.assign(o, u))
            }

            return o
          }
        )
        state.zhDict.insert(
          Array.from(newItems).map((entry) => {
            const r = Object.assign({ entry }, uMap.get(entry) || {}) as any
            select.map((k) => {
              if (k === 'alt' || k === 'reading' || k === 'english') {
                r[k] = []
              }
            })

            return ensureSchema(sDictionary, r)
          })
        )

        return state.zhDict
          .chain()
          .find(cond)
          .simplesort('frequency', true)
          .data()
          .map((el: any) => {
            const r = {} as any
            select.map((k) => {
              r[k] = el[k]
            })
            return r
          })
      }

      return result
        .slice(0, limit === -1 ? undefined : limit || 10)
        .map((el: any) => {
          const r = {} as any
          select.map((k) => {
            r[k] = el[k]
          })
          return r
        })
    },
    async random(
      { state },
      {
        type,
        count,
      }: {
        type: IDictionaryType
        count: number
      }
    ): Promise<
      {
        entry: string
        english: string
        level: number
      }[]
    > {
      const { result } = await this.$axios.$get('/api/dictionary/random', {
        params: {
          level: this.app.$accessor.level || 1,
          type,
          count,
        },
      })

      if (state.zhDict) {
        state.zhDict.insert(
          ensureSchema(
            S.list(sDictionary),
            result.map((r: any) => ({
              entry: r.entry,
              english: r.english,
            }))
          )
        )
      }

      return result
    },
  }
)
