import dotProp from 'dot-prop-immutable'
import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { DbCategoryModel, DbItemModel, DbQuizModel } from '@/db/mongo'
import { reduceToObj } from '@/util'
import { checkAuthorize } from '@/util/api'
import { safeString } from '@/util/mongo'
import {
  sJoinedComma,
  sPageFalsable,
  sSortJoinedComma,
  sSrsLevel,
  sStringNonEmpty,
  sStringOneOrPairInteger,
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
  const myDictionaryJoinedComma = sJoinedComma(['hanzi', 'vocab', 'sentence'])

  getSrsLevel()
  getMatch()
  doQuery()
  doRandom()

  next()

  function getSrsLevel() {
    const sQuery = S.shape({
      lang: sJoinedComma(['chinese']),
    })

    const sResponse = S.shape({
      result: S.list(
        S.shape({
          entry: S.string(),
          srsLevel: sSrsLevel.optional(),
        })
      ),
    })

    f.post<typeof sQuery.type>(
      '/srsLevel',
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
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { lang = 'chinese' } = req.query

        const [langFrom, langTo = 'english'] = lang.split(',')

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
            $group: {
              _id: '$priority',
              categoryIds: { $addToset: '$_id' },
            },
          },
          { $sort: { _id: -1 } },
          {
            $lookup: {
              from: 'item',
              localField: 'categoryId',
              foreignField: 'categoryIds',
              as: 'it',
            },
          },
          { $unwind: '$it' },
          {
            $lookup: {
              from: 'template',
              localField: 'categoryId',
              foreignField: 'categoryIds',
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

  function getMatch() {
    const sQuery = S.shape({
      q: sStringNonEmpty,
      type: myDictionaryType,
      select: sJoinedComma([
        'entry',
        'alt',
        'reading',
        'translation',
      ]).optional(),
      lang: sJoinedComma(['chinese']),
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
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const {
          q,
          type,
          select = 'entry,alt,reading,translation',
          lang = 'chinese',
        } = req.query

        const [langFrom, langTo = 'english'] = lang.split(',')

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
                    type: { $in: type },
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
              reduceToObj(select.split(',').map((k) => [k, 1]))
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
      type: myDictionaryJoinedComma,
      select: sJoinedComma([
        'entry',
        'alt',
        'reading',
        'translation',
      ]).optional(),
      page: sPageFalsable.optional(),
      lang: sSortJoinedComma(['chinese']).optional(),
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
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const {
          q,
          type,
          select = 'entry,alt,reading,translation',
          page: pagination = '',
          lang = 'chinese',
        } = req.query

        let hasCount = false
        let page = 1
        let perPage = 10

        if (pagination !== 'false') {
          hasCount = true
          const p = pagination.split(',').map((p) => parseInt(p))
          page = p[0] || page
          perPage = p[1] || perPage
        }

        const [langFrom, langTo = 'english'] = lang.split(',')

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
                    type: { $in: type.split(',') },
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
                ...(hasCount
                  ? [{ $skip: (page - 1) * perPage }, { $limit: perPage }]
                  : []),
                {
                  $project: Object.assign(
                    { _id: 0 },
                    reduceToObj(select.split(',').map((k) => [k, 1]))
                  ),
                },
              ],
              count: hasCount ? [{ $count: 'count' }] : undefined,
            },
          },
        ])

        return {
          result: r[0]?.result || [],
          count: hasCount
            ? dotProp.get(r[0] || {}, 'count.0.count', 0)
            : undefined,
        }
      }
    )
  }

  function doRandom() {
    const sQuery = S.shape({
      type: myDictionaryType,
      level: sStringOneOrPairInteger.optional(),
      lang: sSortJoinedComma(['chinese']).optional(),
    })

    const sResponse = S.shape({
      result: S.string().optional(),
      translation: S.list(S.string()).optional(),
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

        const { type, level = '60', lang = 'chinese' } = req.query

        const lvArr = level.split(',').map((lv) => parseInt(lv))
        if (lvArr.length === 1) {
          lvArr.unshift(1)
        }

        const [langFrom, langTo = 'english'] = lang.split(',')

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
                    type: { $in: type },
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
                      { level: { $gte: lvArr[0] } },
                      { level: { $lte: lvArr[1] } },
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
