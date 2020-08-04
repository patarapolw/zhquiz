import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { sDict, zhDict, zhToken } from '@/db/local'
import { DbExtraModel, DbQuizModel, sDbExtraExport } from '@/db/mongo'
import { checkAuthorize } from '@/util/api'
import { sDictType, sLevel, sQuizType, sStringNonEmpty } from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  getQ()
  getMatch()
  getAlt()
  getRandom()
  getLevel()

  next()

  function getQ() {
    const sQuery = S.shape({
      type: sQuizType,
      q: sStringNonEmpty.optional(),
      select: S.list(S.string()).minItems(1).optional(),
      sort: S.list(S.string()).minItems(1).optional(),
      offset: S.integer().minimum(0).optional(),
      limit: S.integer().minimum(-1).optional(),
    })

    const sResponse = S.shape({
      result: S.list(S.object().additionalProperties(true)),
      count: S.integer().optional(),
    })

    f.get<{
      Querystring: typeof sQuery.type
    }>(
      '/q',
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

        const { type, q, select, sort, offset = 0, limit } = req.query

        if (type === 'extra') {
          const cond = {
            userId,
            ...(q
              ? {
                  chinese: {
                    $regex: new RegExp(
                      q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    ),
                  },
                }
              : {}),
          }

          let cursor = DbExtraModel.find(cond)
            .sort(sort ? sort.join(' ') : '-updatedAt')
            .select(select ? select.join(' ') : 'chinese pinyin english')
            .skip(offset)

          if (limit !== -1) {
            cursor = cursor.limit(limit || 10)
          }

          const count = await DbExtraModel.countDocuments(cond)

          return {
            result: await cursor,
            count,
          }
        } else {
          const cond = q
            ? {
                entry: { $contains: q },
              }
            : {}

          let cursor = zhDict[type].chain().find(cond)
          const count = cursor.branch().count()

          cursor = cursor
            .compoundsort(
              sort
                ? sort.map((s) =>
                    s[0] === '-' ? [s.substr(1) as any, true] : (s as any)
                  )
                : ['frequency', true]
            )
            .offset(offset)

          if (limit !== -1) {
            cursor = cursor.limit(limit || 10)
          }

          return {
            result: cursor.data().map((d: any) => {
              return (select || ['entry', 'alt', 'reading', 'english']).reduce(
                (prev, k) => ({ ...prev, [k]: d[k] }),
                {} as any
              )
            }),
            count,
          }
        }
      }
    )
  }

  function getMatch() {
    const sQuery = S.shape({
      type: S.anyOf(sQuizType, S.string().enum('token')),
      entry: sStringNonEmpty,
      select: S.list(S.string()).minItems(1).optional(),
    })

    const sResponse = sDbExtraExport

    f.get<{
      Querystring: typeof sQuery.type
    }>(
      '/',
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

        const { type, entry, select } = req.query

        if (type === 'extra') {
          const r = await DbExtraModel.findOne({
            userId,
            chinese: entry,
          }).select((select || ['chinese', 'pinyin', 'english']).join(' '))

          return r || {}
        } else if (type === 'token') {
          const r: any = zhToken.findOne({ entry }) || {}

          return (select || ['entry', 'sub', 'sup', 'variants']).reduce(
            (prev, k) => ({ ...prev, [k]: r[k] }),
            {} as any
          )
        } else {
          const r: any = zhDict[type].findOne({ entry }) || {}

          return (select || ['entry', 'alt', 'reading', 'english']).reduce(
            (prev, k) => ({ ...prev, [k]: r[k] }),
            {} as any
          )
        }
      }
    )
  }

  function getAlt() {
    const sQuery = S.shape({
      type: S.string().enum('vocab', 'token'),
      q: sStringNonEmpty,
      select: S.list(S.string()).minItems(1).optional(),
      sort: S.list(S.string()).minItems(1).optional(),
    })

    const sResponse = S.shape({
      result: S.list(S.object().additionalProperties(true)),
      count: S.integer().optional(),
    })

    f.get<{
      Querystring: typeof sQuery.type
    }>(
      '/alt',
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

        const { type, q, select, sort } = req.query

        if (type === 'token') {
          const cond = {
            entry: q,
            variants: { $in: q },
          }

          let cursor = zhToken.chain().find(cond)
          const count = cursor.branch().count()

          cursor = cursor.compoundsort(
            sort
              ? sort.map((s) =>
                  s[0] === '-' ? [s.substr(1) as any, true] : (s as any)
                )
              : ['frequency', true]
          )

          return {
            result: cursor.data().map((d: any) => {
              return (select || ['entry', 'sub', 'sup', 'variants']).reduce(
                (prev, k) => ({ ...prev, [k]: d[k] }),
                {} as any
              )
            }),
            count,
          }
        } else {
          const cond = {
            entry: q,
            alt: { $in: q },
          }

          let cursor = zhDict[type].chain().find(cond)
          const count = cursor.branch().count()

          cursor = cursor.compoundsort(
            sort
              ? sort.map((s) =>
                  s[0] === '-' ? [s.substr(1) as any, true] : (s as any)
                )
              : ['frequency', true]
          )

          return {
            result: cursor.data().map((d: any) => {
              return (select || ['entry', 'alt', 'reading', 'english']).reduce(
                (prev, k) => ({ ...prev, [k]: d[k] }),
                {} as any
              )
            }),
            count,
          }
        }
      }
    )
  }

  function getRandom() {
    const sQuery = S.shape({
      type: sDictType,
      levelMin: sLevel.optional(),
      level: sLevel.optional(),
    })

    const sResponse = S.shape({
      result: S.string().optional(),
      english: S.string().optional(),
      level: S.integer().optional(),
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
          return {}
        }

        const { type, levelMin = 1, level = 60 } = req.query

        const hsMap = new Map<string, number>()

        zhDict[type]
          .find({
            $and: [{ level: { $lte: level } }, { level: { $gte: levelMin } }],
          })
          .map(({ entry, level }) => {
            if (level) {
              hsMap.set(entry, level)
            }
          })

        const reviewing = new Set<string>(
          (
            await DbQuizModel.find({
              userId,
              entry: { $in: Array.from(hsMap.keys()) },
              type,
              nextReview: { $exists: true },
            }).select('entry')
          ).map((el) => el.entry)
        )

        const hs = Array.from(hsMap).filter(([h]) => !reviewing.has(h))
        if (hs.length === 0) {
          return {}
        }

        const [h, lv] = hs[Math.floor(Math.random() * hs.length)]

        const r = zhDict[type].findOne({ entry: h })

        return {
          result: h,
          english: r ? r.english[0] : undefined,
          level: lv,
        }
      }
    )
  }

  function getLevel() {
    const sQuery = S.shape({
      type: S.string().enum('hanzi', 'vocab'),
    })

    const sResponse = S.shape({
      result: S.list(
        S.shape({
          entry: S.string(),
          level: S.integer().optional(),
          srsLevel: S.integer().optional(),
        })
      ),
    })

    f.get<{
      Querystring: typeof sQuery.type
    }>(
      '/level',
      {
        schema: {
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return {
            result: [],
          }
        }

        const { type } = req.query

        const hsMap = new Map<string, typeof sDict.type>()
        zhDict[type]
          .chain()
          .find({
            level: { $ne: undefined },
          })
          .compoundsort([
            ['level', false],
            ['frequency', true],
          ])
          .data()
          .map((d) => {
            if (d.level) {
              hsMap.set(d.entry, d)
            }
          })

        const r = await DbQuizModel.find({
          userId,
          entry: {
            $in: Array.from(hsMap.keys()),
          },
          type,
        })

        const srsLevelMap = new Map<string, number>()
        r.map(({ entry, srsLevel = -1 }) => {
          srsLevelMap.set(entry, srsLevel)
        })

        return {
          result: Array.from(hsMap).map(([entry, d]) => ({
            entry,
            level: d.level,
            srsLevel: srsLevelMap.get(entry),
          })),
        }
      }
    )
  }
}
