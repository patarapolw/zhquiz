import makePinyin from 'chinese-to-pinyin'
import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'
import jieba from 'nodejieba'

import { sDictionaryExport, zhDictionary } from '@/db/local'
import { DbQuizModel } from '@/db/mongo'
import { pickObj } from '@/util'
import { checkAuthorize } from '@/util/api'
import {
  ensureSchema,
  sDictionaryType,
  sPageFalsable,
  sSrsLevel,
  sStringNonEmpty,
  sStringOneOrPairInteger,
} from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['chinese']

  chineseSrsLevel()
  chineseMatch()
  chineseQ()
  chineseRandom()
  chineseJieba()
  chinesePinyin()

  next()

  function chineseSrsLevel() {
    const sResponse = S.shape({
      result: S.list(
        S.shape({
          entry: S.string(),
          srsLevel: sSrsLevel.optional(),
        })
      ),
    })

    f.post(
      '/srsLevel',
      {
        schema: {
          tags,
          summary: 'Get srs levels for every items',
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<undefined | typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const result = await DbQuizModel.aggregate([
          {
            $match: {
              userId,
              entry: {
                $in: zhDictionary
                  .find({
                    type: 'vocab',
                    // @ts-ignore
                    level: { $exists: true },
                  })
                  .map((el) => el.entry),
              },
            },
          },
          {
            $lookup: {
              from: 'template',
              localField: 'templateId',
              foreignField: '_id',
              as: 't',
            },
          },
          {
            $match: {
              't.language': 'chinese',
              't.type': 'vocab',
            },
          },
          {
            $group: {
              _id: '$entry',
              srsLevel: { $max: '$srsLevel' },
            },
          },
          {
            $project: {
              _id: 0,
              entry: '$_id',
              srsLevel: 1,
            },
          },
        ])

        return {
          result,
        }
      }
    )
  }

  function chineseMatch() {
    const sQuery = S.shape({
      q: sStringNonEmpty,
      type: sDictionaryType,
      select: sStringNonEmpty.optional(),
    })

    f.get<typeof sQuery.type>(
      '/match',
      {
        schema: {
          tags,
          summary: 'Look up Chinese dictionary for a matched item',
          querystring: sQuery.valueOf(),
          response: {
            200: sDictionaryExport.valueOf(),
          },
        },
      },
      async (req) => {
        const {
          q,
          type,
          select = 'entry,alt,reading,translation',
        } = ensureSchema(sQuery, req.query)

        const r =
          zhDictionary
            .chain()
            .find({ entry: q, type })
            .compoundsort([
              ['priority', true],
              ['frequency', true],
            ])
            .limit(1)
            .data()[0] || ({} as any)

        return ensureSchema(
          sDictionaryExport,
          pickObj(r as any, select.split(',')) as any
        )
      }
    )
  }

  function chineseQ() {
    const sQuery = S.shape({
      q: sStringNonEmpty,
      type: sDictionaryType,
      select: sStringNonEmpty.optional(),
      page: sPageFalsable.optional(),
    })

    const sResponse = S.shape({
      result: S.list(sDictionaryExport),
      count: S.integer().minimum(0).optional(),
    })

    f.get<typeof sQuery.type>(
      '/q',
      {
        schema: {
          tags,
          summary: 'Look up Chinese dictionary containing the item',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req): Promise<typeof sResponse.type> => {
        const {
          q,
          type,
          select = 'entry,alt,reading,translation',
          page: pagination,
        } = ensureSchema(sQuery, req.query)

        const cond = { entry: { $containsString: q }, type }

        let rs = zhDictionary
          .chain()
          .find(cond)
          .compoundsort([
            ['priority', true],
            ['frequency', true],
          ])
          .data()
        const ks = select.split(',')

        let hasCount = false
        if (pagination !== 'false') {
          hasCount = true
          const [page = 1, perPage = 10] = (pagination || '')
            .split(',')
            .map((p) => parseInt(p) || undefined)
          rs = rs.slice((page - 1) * perPage, page * perPage)
        }

        return {
          result: rs.map((r) => pickObj(r as any, ks)),
          count: hasCount ? zhDictionary.count(cond) : undefined,
        }
      }
    )
  }

  function chineseRandom() {
    const sQuery = S.shape({
      type: sDictionaryType,
      level: sStringOneOrPairInteger.optional(),
    })

    const sResponse = S.shape({
      result: S.string().optional(),
      translation: S.string().optional(),
    })

    f.post<typeof sQuery.type>(
      '/random',
      {
        schema: {
          tags,
          summary: 'Get a random Chinese dictionary entry',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<undefined | typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { type, level = '60' } = ensureSchema(sQuery, req.query)

        const lvArr = level.split(',').map((lv) => parseInt(lv))
        if (lvArr.length === 1) {
          lvArr.unshift(1)
        }

        const reviewing: string[] = (
          await DbQuizModel.aggregate([
            {
              $match: {
                userId,
                nextReview: { $exists: true },
              },
            },
            {
              $lookup: {
                from: 'template',
                localField: 'templateId',
                foreignField: '_id',
                as: 't',
              },
            },
            {
              $match: {
                't.language': 'chinese',
                't.type': type,
              },
            },
            {
              $project: {
                _id: 0,
                entry: 1,
              },
            },
          ])
        ).map((el) => el.item)

        const rs = zhDictionary
          .find({
            entry: { $nin: reviewing },
            type,
            level: { $between: lvArr },
            // @ts-ignore
            priority: { $exists: true },
          })
          .reduce(
            (prev, { entry: result, translation: [translation], priority }) => {
              if (priority) {
                const it = prev.get(priority) || []
                it.push({ result, translation })
                prev.set(priority, it)
              }

              return prev
            },
            new Map<
              number,
              {
                result: string
                translation?: string
              }[]
            >()
          )

        for (const [, it] of Array.from(rs).sort(([p1], [p2]) => p2 - p1)) {
          if (it.length > 0) {
            return it.sort(() => 0.5 - Math.random())[0]
          }
        }

        return {}
      }
    )
  }

  function chineseJieba() {
    const sQuery = S.shape({
      q: sStringNonEmpty,
    })
    const sResponse = S.shape({
      result: S.list(S.string()),
    })

    f.get<typeof sQuery.type>(
      '/jieba',
      {
        schema: {
          tags,
          summary: 'Cut chinese text into segments',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req): Promise<typeof sResponse.type> => {
        const { q } = ensureSchema(sQuery, req.query)

        return {
          result: jieba.cut(q),
        }
      }
    )
  }

  function chinesePinyin() {
    const sQuery = S.shape({
      q: sStringNonEmpty,
    })
    const sResponse = S.shape({
      result: sStringNonEmpty,
    })

    f.get<typeof sQuery.type>(
      '/pinyin',
      {
        schema: {
          tags,
          summary: 'Generate pinyin from Chinese text',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req) => {
        const { q } = req.query

        return {
          result: makePinyin(q, { keepRest: true }),
        }
      }
    )
  }
}
