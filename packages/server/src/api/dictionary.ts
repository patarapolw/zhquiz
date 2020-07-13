import {
  DefaultHeaders,
  DefaultParams,
  DefaultQuery,
  FastifyInstance,
} from 'fastify'
import S from 'jsonschema-definer'

import {
  DbCategoryModel,
  DbItemModel,
  sDbItemExportPartial,
  sDbItemExportSelect,
} from '@/db/mongo'
import { reduceToObj } from '@/util'
import { checkAuthorize } from '@/util/api'
import { safeString } from '@/util/mongo'
import {
  sDictionaryType,
  sLang,
  sLevel,
  sPagination,
  sSrsLevel,
} from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['dictionary']
  const myShapeDictionaryQuery = {
    type: S.list(sDictionaryType).minItems(1),
    select: S.list(sDbItemExportSelect).minItems(1),
    lang: S.array()
      .items([S.string().enum('chinese')])
      .optional(),
  }

  getLevel()
  getMatchAlt()
  getMatchExact()
  getSearch()
  postSearchExcluded()
  getRandom()

  next()

  function getLevel() {
    const sQuery = S.shape({
      lang: S.string().enum('chinese').optional(),
    })

    const sResponse = S.shape({
      result: S.list(
        S.shape({
          entry: S.string().optional(),
          level: S.integer().minimum(1).maximum(60).optional(),
          srsLevel: sSrsLevel.optional(),
        })
      ),
    })

    f.get<typeof sQuery.type>(
      '/level',
      {
        schema: {
          tags,
          summary: 'Get srs levels for every items',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<typeof sResponse.type> => {
        reply.header('Cache-Control', 'no-cache')

        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return undefined as any
        }

        const { lang } = req.query
        let [langFrom, langTo] = lang || []
        langFrom = langFrom || 'chinese'
        langTo = langTo || 'english'

        const result = await DbCategoryModel.aggregate([
          {
            $match: {
              userId: { $in: [userId, 'shared', 'default'] },
              type: 'vocab',
              langFrom: safeString(langFrom),
              langTo: safeString(langTo),
            },
          },
          {
            $lookup: {
              from: 'item',
              localField: 'categoryId',
              foreignField: '_id',
              as: 'it',
            },
          },
          { $unwind: '$it' },
          {
            $lookup: {
              from: 'template',
              localField: 'categoryId',
              foreignField: '_id',
              as: 't',
            },
          },
          { $unwind: '$t' },
          { $match: { 'it.level': { $exists: true } } },
          {
            $lookup: {
              from: 'quiz',
              let: {
                entry: '$it.entry',
                templateId: '$t._id',
              },
              pipeline: [
                {
                  $match: {
                    $and: [
                      { userId },
                      {
                        $expr: {
                          $and: [
                            { $eq: ['entry', '$$entry'] },
                            { $eq: ['templateId', '$$templateId'] },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
              as: 'q',
            },
          },
          { $unwind: '$q' },
          {
            $group: {
              _id: '$it.entry',
              srsLevel: { $max: '$q.srsLevel' },
              level: { $max: '$it.level' },
            },
          },
          { $addFields: { entry: '$_id' } },
          { $project: { _id: 0 } },
        ])

        return {
          result,
        }
      }
    )
  }

  function getMatchAlt() {
    const sQuery = S.shape({
      q: S.string(),
      ...myShapeDictionaryQuery,
    })

    const sResponse = S.shape({
      result: S.list(sDbItemExportPartial),
      count: S.integer().minimum(0).optional(),
    })

    f.get<typeof sQuery.type>(
      '/matchAlt',
      {
        schema: {
          tags,
          summary: 'Look up Chinese dictionary for a matched item',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<typeof sResponse.type> => {
        reply.header('Cache-Control', 'no-cache')

        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return undefined as any
        }

        const { q, type, select, lang } = req.query
        const [langFrom = 'chinese', langTo = 'english'] = lang || []

        return await _doquery({
          firstCond: {
            $match: { $or: [{ entry: q }, { alt: q }] },
          },
          userId,
          type,
          select,
          // limit: -1,
          langFrom,
          langTo,
        })
      }
    )
  }

  function getMatchExact() {
    const sQuery = S.shape({
      q: S.string(),
      ...myShapeDictionaryQuery,
    })

    const sResponse = S.shape({
      result: sDbItemExportPartial.optional(),
    })

    f.get<typeof sQuery.type>(
      '/matchExact',
      {
        schema: {
          tags,
          summary: 'Look up Chinese dictionary for a matched item',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<typeof sResponse.type> => {
        reply.header('Cache-Control', 'no-cache')

        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return undefined as any
        }

        const { q, type, select, lang = [] } = req.query

        const [langFrom = 'chinese', langTo = 'english'] = lang

        const {
          result: [result],
        } = await _doquery({
          firstCond: {
            $match: { entry: q },
          },
          userId,
          type,
          select,
          limit: 1,
          langFrom,
          langTo,
        })

        return { result }
      }
    )
  }

  function getSearch() {
    const sQuery = S.shape({
      q: S.string(),
      ...myShapeDictionaryQuery,
      page: sPagination.optional(),
      limit: S.integer().minimum(-1),
    })

    const sResponse = S.shape({
      result: S.list(sDbItemExportPartial),
      count: S.integer().minimum(0).optional(),
    })

    f.get<typeof sQuery.type>(
      '/search',
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
      async (req, reply): Promise<typeof sResponse.type> => {
        reply.header('Cache-Control', 'no-cache')

        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return undefined as any
        }

        const {
          q,
          type,
          select,
          page: [page, perPage] = [],
          limit = 10,
          lang = [],
        } = req.query

        const [langFrom = 'chinese', langTo = 'english'] = lang

        return await _doquery({
          firstCond: {
            $match: {
              $text: {
                $search: safeString(q),
                $language: langFrom,
              },
            },
          },
          userId,
          type,
          select,
          page,
          perPage,
          limit,
          langFrom,
          langTo,
        })
      }
    )
  }

  function postSearchExcluded() {
    const sBody = S.shape({
      q: S.string(),
      type: S.list(sDictionaryType).minItems(1),
      select: S.list(sDbItemExportSelect).minItems(1),
      limit: S.integer().minimum(-1).optional(),
      exclude: S.list(S.string()),
      lang: sLang.optional(),
    })

    const sResponse = S.shape({
      result: S.list(sDbItemExportPartial),
      count: S.integer().minimum(0).optional(),
    })

    f.post<DefaultQuery, DefaultParams, DefaultHeaders, typeof sBody.type>(
      '/search',
      {
        schema: {
          tags,
          summary: 'Look up Chinese dictionary containing the item',
          body: sBody.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<typeof sResponse.type> => {
        reply.header('Cache-Control', 'no-cache')

        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return undefined as any
        }

        const { q, type, select, limit = 10, lang = [] } = req.body

        const [langFrom = 'chinese', langTo = 'english'] = lang

        return await _doquery({
          firstCond: {
            $match: {
              $text: {
                $search: safeString(q),
                $language: 'chinese',
              },
            },
          },
          userId,
          type,
          select,
          limit,
          langFrom,
          langTo,
        })
      }
    )
  }

  function getRandom() {
    const sQuery = S.shape({
      level: sLevel.optional(),
      ...myShapeDictionaryQuery,
    })

    const sResponse = S.shape({
      result: S.list(sDbItemExportPartial),
      count: S.integer().minimum(0).optional(),
    })

    f.get<typeof sQuery.type>(
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
      async (req, reply): Promise<typeof sResponse.type> => {
        reply.header('Cache-Control', 'no-cache')

        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return undefined as any
        }

        const { type, level = [60], lang = [], select } = req.query

        if (level.length === 1) {
          level.unshift(1)
        }

        const [langFrom = 'chinese', langTo = 'english'] = lang

        return await _doquery({
          random: {
            levelMin: level[0],
            levelMax: level[1],
          },
          userId,
          type,
          select,
          limit: 1,
          langFrom,
          langTo,
        })
      }
    )
  }

  async function _doquery(o: {
    userId: string
    firstCond?: any
    random?: {
      levelMin: number
      levelMax: number
    }
    langFrom?: string
    langTo?: string
    type: string[]
    page?: number
    perPage?: number
    limit?: number
    select: string[]
  }) {
    o.langFrom = o.langFrom || 'chinese'
    o.langTo = o.langTo || 'english'

    const r = await DbItemModel.aggregate([
      ...(o.firstCond ? [o.firstCond] : []),
      ...(o.random
        ? [
            {
              $match: {
                $and: [
                  { level: { $gte: o.random!.levelMin || 1 } },
                  { level: { $lte: o.random!.levelMax || 60 } },
                ],
              },
            },
            {
              $lookup: {
                from: 'quiz',
                let: {
                  entry: '$entry',
                },
                pipeline: [
                  { $match: { $expr: { $eq: ['$entry', '$$entry'] } } },
                  {
                    $match: {
                      $and: [
                        {
                          userId: o.userId,
                          nextReview: { $exists: true },
                        },
                      ],
                    },
                  },
                ],
                as: 'q',
              },
            },
            { $match: { q: { $size: { $gt: 0 } } } },
          ]
        : []),
      {
        $lookup: {
          from: 'category',
          let: {
            categoryId: '$categoryId',
          },
          pipeline: [
            {
              $match: {
                userId: {
                  $in: [o.userId, 'shared', 'default'],
                },
                type: { $in: o.type.map(safeString) },
                langFrom: o.langFrom,
                langTo: o.langTo,
              },
            },
            { $match: { $expr: { $eq: ['$_id', '$$categoryId'] } } },
          ],
          as: 'c',
        },
      },
      ...(o.random
        ? [
            {
              $match: {
                c: { $size: { $gt: 0 } },
              },
            },
            { $sample: { size: 1 } },
          ]
        : []),
      { $unwind: '$c' },
      { $unwind: { $path: '$alt', preserveNullAndEmptyArrays: true } },
      { $unwind: { $path: '$reading', preserveNullAndEmptyArrays: true } },
      {
        $unwind: {
          $path: '$translation',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        group: {
          _id: 'entry',
          cPriority: { $max: '$c.priority' },
          priority: { $max: '$priority' },
          frequency: { $max: '$frequency' },
          alt: { $push: '$alt' },
          reading: { $push: '$reading' },
          translation: { $push: '$translation' },
        },
      },
      {
        $facet: {
          result: [
            {
              $sort: {
                cPriority: -1,
                priority: -1,
                frequency: -1,
              },
            },
            ...(o.page && o.perPage
              ? [{ $skip: (o.page - 1) * o.perPage }]
              : []),
            ...((o.perPage || o.limit) && o.limit !== -1
              ? [{ $limit: o.perPage || o.limit }]
              : []),
            {
              $project: Object.assign(
                { _id: 0 },
                reduceToObj(o.select.map((k) => [k, 1]))
              ),
            },
          ],
          count: o.page ? [{ $count: 'count' }] : undefined,
        },
      },
    ])

    return {
      result: (r[0]?.result || []) as typeof sDbItemExportPartial.type[],
      count: o.page
        ? (((r[0] || {}).count || [])[0] || {}).count || 0
        : undefined,
    }
  }
}
