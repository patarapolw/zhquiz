import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { zhDictionary } from '@/db/local'
import { DbQuizModel } from '@/db/mongo'
import { checkAuthorize } from '@/util/api'
import { sDictionaryType, sLevel, sStringNonEmpty } from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  postSearch()
  getRandom()
  getAllLevels()
  getCurrentLevel()

  next()

  function postSearch() {
    const sBody = S.shape({
      strategy: S.string().enum('match', 'alt', 'contains'),
      q: sStringNonEmpty.optional(),
      type: sDictionaryType,
      select: S.list(
        S.string().enum('entry', 'alt', 'reading', 'english', 'frequency')
      ),
      limit: S.integer().minimum(-1).optional(),
      exclude: S.list(S.string()),
    })

    const sResponse = S.shape({
      result: S.list(
        S.shape({
          entry: S.string().optional(),
          alt: S.list(S.string()).minItems(1).uniqueItems().optional(),
          reading: S.list(S.string()).minItems(1).uniqueItems().optional(),
          english: S.list(S.string()).minItems(1).uniqueItems().optional(),
          frequency: S.number().optional(),
        })
      ),
    })

    f.post<{
      Body: typeof sBody.type
    }>(
      '/q',
      {
        schema: {
          body: sBody.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req): Promise<typeof sResponse.type> => {
        const { strategy, q, type, select, limit, exclude } = req.body
        const qs = (q || '').split(' ')

        const rs = zhDictionary.find({
          $and: [
            { entry: { $nin: exclude } },
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
        })

        return {
          result: rs
            .slice(0, limit === -1 ? undefined : limit || 10)
            .sort(({ frequency: f1 = 0 }, { frequency: f2 = 0 }) => f2 - f1)
            .map((r) =>
              select.reduce((prev, k) => ({ ...prev, [k]: r[k] }), {} as any)
            ),
        }
      }
    )
  }

  function getRandom() {
    const sQuery = S.shape({
      level: sLevel,
      type: sDictionaryType,
      count: S.integer().minimum(1).optional(),
    })

    const sResponse = S.shape({
      result: S.list(
        S.shape({
          entry: S.string(),
          english: S.list(S.string()),
          level: sLevel,
        })
      ),
    })

    f.get<{
      Querystring: typeof sQuery.type
    }>(
      '/random',
      {
        schema: {
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return undefined as any
        }

        const { level, type, count = 1 } = req.query

        const allMatched = zhDictionary.find({ type, level: { $lte: level } })

        const reviewing = new Set<string>(
          (
            await DbQuizModel.find({
              userId,
              entry: { $in: allMatched.map(({ entry }) => entry) },
              type,
              nextReview: { $exists: true },
            }).select('-_id entry')
          ).map((el) => el.entry)
        )

        const hs = allMatched.filter(({ entry }) => !reviewing.has(entry))
        const result = Array.from({ length: count })
          .map(() => {
            if (hs.length) {
              const i = Math.floor(Math.random() * hs.length)
              return hs.splice(i, 1)[0]
            }
            return null
          })
          .filter((el) => el)
          .map((el) => ({
            entry: el!.entry,
            english: el!.english,
            level: el!.level!,
          }))

        return {
          result,
        }
      }
    )
  }

  function getAllLevels() {
    const sQuery = S.shape({
      type: sDictionaryType,
    })

    const sResponse = S.shape({
      result: S.list(
        S.shape({
          entry: S.string(),
          level: S.integer().minimum(1).maximum(60),
          srsLevel: S.integer(),
        })
      ),
    })

    f.get<{
      Querystring: typeof sQuery.type
    }>(
      '/allLevels',
      {
        schema: {
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return undefined as any
        }

        const { type } = req.query
        const lvMap = zhDictionary
          // @ts-ignore
          .find({ type, level: { $exists: true } })
          .reduce((prev, { entry, level }) => {
            if (level) {
              lvMap.set(entry, level)
            }
            return prev
          }, new Map<string, number>())

        const rMap = new Map<
          string,
          {
            level: number
            srs: number[]
          }
        >()

        const rs = await DbQuizModel.find({
          userId,
          type,
          entry: {
            $in: Array.from(lvMap.keys()),
          },
        }).select('-_id entry srsLevel')

        rs.filter(({ entry }) => lvMap.get(entry)).map(
          ({ entry, srsLevel }) => {
            const r = rMap.get(entry) || {
              level: lvMap.get(entry)!,
              srs: [],
            }

            if (typeof srsLevel === 'number') {
              r.srs.push(srsLevel)
            }

            rMap.set(entry, r)
          }
        )

        return {
          result: Array.from(rMap)
            .map(([entry, { level, srs }]) => ({
              entry,
              level,
              srsLevel: Math.max(-1, ...srs),
            }))
            .sort((a, b) => b.level - a.level),
        }
      }
    )
  }

  function getCurrentLevel() {
    const sQuery = S.shape({
      type: sDictionaryType,
    })

    const sResponse = S.shape({
      level: S.integer(),
    })

    f.get<{
      Querystring: typeof sQuery.type
    }>(
      '/currentLevel',
      {
        schema: {
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return undefined as any
        }

        const { type } = req.query
        const lvMap = zhDictionary
          // @ts-ignore
          .find({ type, level: { $exists: true } })
          .reduce((prev, { entry, level }) => {
            if (level) {
              lvMap.set(entry, level)
            }
            return prev
          }, new Map<string, number>())

        const existing = (
          await DbQuizModel.find({
            userId,
            'dictionary.type': 'vocab',
            entry: {
              $in: Array.from(lvMap.keys()),
            },
          }).select('-_id entry')
        ).reduce((prev, { entry }) => {
          if (!prev.has(entry)) {
            prev.set(entry, lvMap.get(entry)!)
          }

          return prev
        }, new Map<string, number>())
        const itemCount = Array.from(existing).reduce(
          (prev, [entry, level]) => {
            const s = prev.get(level) || new Set()
            s.add(entry)
            prev.set(level, s)

            return prev
          },
          new Map<number, Set<string>>()
        )

        const level = Math.min(
          1,
          ...Array.from(itemCount)
            .filter(([, its]) => its.size >= 10)
            .map(([lv]) => lv)
        )

        return {
          level,
        }
      }
    )
  }
}
