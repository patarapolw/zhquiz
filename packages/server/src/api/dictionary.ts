import dotProp from 'dot-prop-immutable'
import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { DbCategoryModel, DbItemModel, DbQuizModel } from '@/db/mongo'
import { arrayize, reduceToObj } from '@/util'
import { checkAuthorize } from '@/util/api'
import { safeString } from '@/util/mongo'
import {
  sSrsLevel,
  sStringIntegerNonNegative,
  sStringNonEmpty,
} from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['dictionary']
  const myDictionaryItemPartial = S.shape({
    entry: sStringNonEmpty.optional(),
    alt: S.list(S.string()).optional(),
    reading: S.list(S.string()).optional(),
    translation: S.list(S.string()).optional(),
  })
  const myDictionaryType = S.string().enum('hanzi', 'vocab', 'sentence')

  getLevel()
  getMatch()
  doQuery()
  doRandom()

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
      async (req, reply): Promise<undefined | typeof sResponse.type> => {
        reply.header('Cache-Control', 'no-cache')

        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { lang } = req.query
        let [langFrom, langTo] = arrayize(lang) as string[]
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

  function getMatch() {
    const sQuery = S.shape({
      q: sStringNonEmpty,
      type: myDictionaryType,
      select: S.list(
        S.string().enum('entry', 'alt', 'reading', 'translation')
      ).optional(),
      lang: S.string().enum('chinese').optional(),
    })

    const sResponse = S.shape({
      result: S.list(myDictionaryItemPartial),
    })

    f.get<typeof sQuery.type>(
      '/match',
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
      async (req, reply): Promise<undefined | typeof sResponse.type> => {
        reply.header('Cache-Control', 'no-cache')

        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const {
          q,
          type,
          select = ['entry', 'alt', 'reading', 'translation'],
          lang,
        } = req.query

        let [langFrom, langTo] = arrayize(lang) as string[]
        langFrom = langFrom || 'chinese'
        langTo = langTo || 'english'

        const r = await DbItemModel.aggregate([
          {
            $match: {
              $or: [{ entry: q }, { alt: q }],
            },
          },
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
                      $in: [userId, 'shared', 'default'],
                    },
                    type: safeString(type),
                    langFrom: safeString(langFrom),
                    langTo: safeString(langTo),
                  },
                },
                { $match: { $expr: { $eq: ['$_id', '$$categoryId'] } } },
              ],
              as: 'c',
            },
          },
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
            $sort: {
              cPriority: -1,
              priority: -1,
              frequency: -1,
            },
          },
          {
            $project: Object.assign(
              { _id: 0 },
              reduceToObj(select.map((k) => [k, 1]))
            ),
          },
        ])

        return {
          result: r,
        }
      }
    )
  }

  function doQuery() {
    const sQuery = S.shape({
      q: sStringNonEmpty,
      type: S.anyOf(myDictionaryType, S.list(myDictionaryType)),
      select: S.list(
        S.string().enum('entry', 'alt', 'reading', 'translation')
      ).optional(),
      page: S.anyOf(
        sStringIntegerNonNegative,
        S.list(sStringIntegerNonNegative).minItems(2).maxItems(2)
      ).optional(),
      limit: S.anyOf(sStringIntegerNonNegative, S.string().enum('-1')),
      lang: S.string().enum('chinese').optional(),
    })

    const sResponse = S.shape({
      result: S.list(myDictionaryItemPartial),
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
      async (req, reply): Promise<undefined | typeof sResponse.type> => {
        reply.header('Cache-Control', 'no-cache')

        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const {
          q,
          type,
          select = ['entry', 'alt', 'reading', 'translation'],
          page: [page, perPage] = [],
          limit = '10',
          lang,
        } = req.query

        let [langFrom, langTo] = arrayize(lang) as string[]
        langFrom = langFrom || 'chinese'
        langTo = langTo || 'english'

        const [iPage, iPerPage, iLimit] = [page, perPage, limit].map((el) =>
          parseInt(el)
        )

        const r = await DbItemModel.aggregate([
          {
            $match: {
              $text: {
                $search: safeString(q),
                $language: safeString(langFrom),
              },
            },
          },
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
                      $in: [userId, 'shared', 'default'],
                    },
                    type: { $in: arrayize(type).map(safeString) },
                    langFrom: safeString(langFrom),
                    langTo: safeString(langTo),
                  },
                },
                { $match: { $expr: { $eq: ['$_id', '$$categoryId'] } } },
              ],
              as: 'c',
            },
          },
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
                ...(iPage && iPerPage
                  ? [{ $skip: (iPage - 1) * iPerPage }]
                  : []),
                ...((iPerPage || iLimit) && iLimit !== -1
                  ? [{ $limit: iPerPage || iLimit }]
                  : []),
                {
                  $project: Object.assign(
                    { _id: 0 },
                    reduceToObj(select.map((k) => [k, 1]))
                  ),
                },
              ],
              count: page ? [{ $count: 'count' }] : undefined,
            },
          },
        ])

        return {
          result: r[0]?.result || [],
          count: page ? dotProp.get(r[0] || {}, 'count.0.count', 0) : undefined,
        }
      }
    )
  }

  function doRandom() {
    const sQuery = S.shape({
      type: myDictionaryType,
      level: S.anyOf(
        sStringIntegerNonNegative,
        S.list(sStringIntegerNonNegative).minItems(2).maxItems(2)
      ).optional(),
      lang: S.string().enum('chinese').optional(),
    })

    const sResponse = S.shape({
      result: S.string().optional(),
      translation: S.list(S.string()).optional(),
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
      async (req, reply): Promise<undefined | typeof sResponse.type> => {
        reply.header('Cache-Control', 'no-cache')

        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { type, level = ['60'], lang } = req.query

        const lvArr = arrayize(level).map((lv) => parseInt(lv))
        if (lvArr.length === 1) {
          lvArr.unshift(1)
        }

        let [langFrom, langTo] = arrayize(lang) as string[]
        langFrom = langFrom || 'chinese'
        langTo = langTo || 'english'

        const r = await DbQuizModel.aggregate([
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
          { $unwind: '$t' },
          {
            $lookup: {
              from: 'category',
              let: {
                categoryId: '$t.categoryId',
              },
              pipeline: [
                {
                  $match: {
                    userId: {
                      $in: [userId, 'shared', 'default'],
                    },
                    type: safeString(type),
                    langFrom: safeString(langFrom),
                    langTo: safeString(langTo),
                  },
                },
                {
                  $match: {
                    $expr: [{ $eq: ['$_id', '$$categoryId'] }],
                  },
                },
              ],
              as: 'c',
            },
          },
          { $unwind: '$c' },
          {
            $lookup: {
              from: 'item',
              let: {
                categoryId: '$c._id',
              },
              pipeline: [
                { $match: { $expr: { $eq: ['$categoryId', '$$categoryId'] } } },
                {
                  $match: {
                    $and: [
                      { level: { $gte: lvArr[0] || 1 } },
                      { level: { $lte: lvArr[1] || 60 } },
                    ],
                  },
                },
                { $sample: { size: 1 } },
              ],
              as: 'it',
            },
          },
          {
            $project: {
              _id: 0,
              result: { $first: '$it.entry' },
              translation: { $first: '$it.translation' },
            },
          },
          { $limit: 1 },
        ])

        return r[0] || {}
      }
    )
  }
}
