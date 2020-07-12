import makePinyin from 'chinese-to-pinyin'
import dotProp from 'dot-prop-immutable'
import { DefaultHeaders, DefaultParams, FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { DbCategoryModel, DbItemModel } from '@/db/mongo'
import { arrayize, reduceToObj } from '@/util'
import { checkAuthorize } from '@/util/api'
import { safeString } from '@/util/mongo'
import {
  sDateTime,
  sDictionaryType,
  sId,
  sListStringNonEmpty,
  sSort,
  sStringIntegerNonNegative,
  sStringNonEmpty,
} from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['item']
  const myItem = S.shape({
    entry: S.string(),
    alt: sListStringNonEmpty.optional(),
    reading: sListStringNonEmpty.optional(),
    translation: sListStringNonEmpty.optional(),
  })
  const myItemPartial = S.shape({
    entry: S.string().optional(),
    alt: sListStringNonEmpty.optional(),
    reading: sListStringNonEmpty.optional(),
    translation: sListStringNonEmpty.optional(),
    updatedAt: sDateTime.optional(),
  })
  const mySelect = S.string().enum(
    '_id',
    'entry',
    'alt',
    'reading',
    'translation'
  )
  const mySelectDefault: typeof mySelect.type[] = [
    '_id',
    'entry',
    'alt',
    'reading',
    'translation',
  ]
  const mySort = sSort([
    'entry',
    'alt.0',
    'reading.0',
    'translation.0',
    'updatedAt',
  ])

  getUserItems()
  doCreate()
  doUpdate()
  doDelete()
  postDeleteByIds()
  doDeleteEntry()

  next()

  function getUserItems() {
    const sQuery = S.shape({
      q: sStringNonEmpty.optional(),
      select: S.anyOf(mySelect, S.list(mySelect)),
      page: S.anyOf(
        sStringIntegerNonNegative,
        S.list(sStringIntegerNonNegative).minItems(2).maxItems(2)
      ).optional(),
      limit: S.anyOf(
        sStringIntegerNonNegative,
        S.string().enum('-1')
      ).optional(),
      sort: S.anyOf(mySort, S.list(mySort)).optional(),
    })

    const sResponse = S.shape({
      result: S.list(myItemPartial),
      count: S.integer().optional(),
    })

    f.get<typeof sQuery.type>(
      '/search',
      {
        schema: {
          tags,
          summary: 'Search for user-created items',
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
          page: [page, perPage] = [],
          limit = '10',
          select = mySelectDefault,
          sort = '-updatedAt',
        } = req.query

        const [iPage, iPerPage, iLimit] = [page, perPage, limit].map((el) =>
          parseInt(el)
        )

        const r = await DbItemModel.aggregate([
          ...(q ? [{ $match: { entry: safeString(q) } }] : []),
          {
            $lookup: {
              from: 'template',
              let: {
                templateId: '$_id',
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ['$_id', '$$templateId'],
                    },
                  },
                },
                {
                  $match: {
                    userId,
                    langFrom: 'chinese',
                    langTo: 'english',
                    type: { $exists: false },
                  },
                },
              ],
              as: 't',
            },
          },
          {
            $match: { t: { $size: { $gt: 0 } } },
          },
          {
            $facet: {
              result: [
                {
                  $sort: arrayize<string>(sort).reduce((prev, k) => {
                    if (k.startsWith('-')) {
                      prev[k.substr(1)] = -1
                    } else {
                      prev[k] = 1
                    }

                    return prev
                  }, {} as Record<string, -1 | 1>),
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
                    reduceToObj(arrayize(select).map((k) => [k, 1]))
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

  function doCreate() {
    const sQuery = S.shape({
      lang: S.string().enum('chinese').optional(),
    })

    const sBody = myItem

    const sResponse = S.shape({
      type: sDictionaryType.optional(),
    })

    f.put<typeof sQuery.type, DefaultParams, DefaultHeaders, typeof sBody.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Create a user-created item',
          body: sBody.valueOf(),
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

        const { lang } = req.query
        let [langFrom, langTo] = arrayize(lang) as string[]
        langFrom = langFrom || 'chinese'
        langTo = langTo || 'english'

        const { entry, reading, translation = [] } = req.body

        const existing = await DbItemModel.aggregate([
          {
            $match: {
              $or: [{ entry }, { alt: entry }],
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
          { $unwind: { path: '$c.type', preserveNullAndEmptyArrays: true } },
          {
            group: {
              _id: 'entry',
              type: { $push: '$c.type' },
            },
          },
          { $limit: 1 },
        ])

        if (existing[0]) {
          return {
            type: dotProp.get(existing[0], 'type.0'),
          }
        }

        const template = await DbCategoryModel.aggregate([
          {
            $match: {
              userId: {
                $in: [userId, 'shared', 'default'],
              },
              type: { $exists: false },
              langFrom: safeString(langFrom),
              langTo: safeString(langTo),
            },
          },
          {
            $sort: {
              priority: -1,
            },
          },
          { $limit: 1 },
          {
            $lookup: {
              from: 'template',
              localField: '_id',
              foreignField: 'categoryId',
              as: 't',
            },
          },
          { $unwind: '$t' },
          {
            $project: {
              _id: 0,
              categoryId: '$_id',
              templateId: '$t._id',
            },
          },
        ])

        if (!template.length) {
          reply
            .status(500)
            .send(
              'Cannot create item due to lack of templating for quiz. Please contact the admin.'
            )
          return
        }

        await DbItemModel.create({
          categoryId: template[0].categoryId,
          entry,
          reading:
            reading && reading[0]
              ? reading
              : langFrom === 'chinese'
              ? [makePinyin(entry, { keepRest: true })]
              : undefined,
          translation,
        })

        return {}
      }
    )
  }

  function doUpdate() {
    const sQuery = S.shape({
      id: S.anyOf(sId, S.list(sId)),
    })

    const sBody = S.shape({
      set: myItemPartial,
    })

    f.patch<
      typeof sQuery.type,
      DefaultParams,
      DefaultHeaders,
      typeof sBody.type
    >(
      '/',
      {
        schema: {
          tags,
          summary: 'Update user-created items',
          body: sBody.partial(),
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { id } = req.query
        const { set } = req.body

        await DbItemModel.updateMany(
          { _id: { $in: arrayize(id) } },
          {
            $set: set,
          }
        )

        reply.status(201).send()
      }
    )
  }

  function doDelete() {
    const sQuery = S.shape({
      id: sId,
    })

    f.delete<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Delete user-created items',
          querystring: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { id } = req.query

        const its = await DbItemModel.aggregate([
          { $match: { _id: id } },
          {
            $lookup: {
              from: 'category',
              let: {
                categoryId: '$categoryId',
              },
              pipeline: [
                {
                  $match: {
                    userId,
                    type: { $exists: false },
                  },
                },
                { $match: { $expr: { $eq: ['$_id', '$$categoryId'] } } },
              ],
              as: 'c',
            },
          },
          { $match: { c: { $size: { $gt: 0 } } } },
          { $project: { _id: 1 } },
        ])

        if (its.length > 0) {
          await DbItemModel.deleteOne({ _id: { $in: its.map((it) => it._id) } })
          reply.status(201).send()
          return
        }

        reply.status(304).send()
      }
    )
  }

  function postDeleteByIds() {
    const sQuery = S.shape({
      ids: S.list(sId),
    })

    f.post<typeof sQuery.type>(
      '/delete/ids',
      {
        schema: {
          tags,
          summary: 'Delete user-created items',
          querystring: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { ids } = req.query

        const its = (
          await DbItemModel.aggregate([
            { $match: { _id: { $in: ids } } },
            {
              $lookup: {
                from: 'category',
                let: {
                  categoryId: '$categoryId',
                },
                pipeline: [
                  {
                    $match: {
                      userId,
                      type: { $exists: false },
                    },
                  },
                  { $match: { $expr: { $eq: ['$_id', '$$categoryId'] } } },
                ],
                as: 'c',
              },
            },
            { $match: { c: { $size: { $gt: 0 } } } },
            { $project: { _id: 1 } },
          ])
        ).map((it) => it._id)

        if (its.length > 0) {
          await DbItemModel.deleteMany({
            _id: { $in: its.map((it) => it._id) },
          })
          reply.status(201).send({
            deleted: its.length,
          })
          return
        }

        reply.status(304).send()
      }
    )
  }

  function doDeleteEntry() {
    const sQuery = S.shape({
      entry: sStringNonEmpty,
    })

    f.delete<typeof sQuery.type>(
      '/entry',
      {
        schema: {
          tags,
          summary: 'Delete user-created items by specifying entry',
          querystring: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { entry } = req.query

        const its = await DbItemModel.aggregate([
          { $match: { entry: safeString(entry) } },
          {
            $lookup: {
              from: 'category',
              let: {
                categoryId: '$categoryId',
              },
              pipeline: [
                {
                  $match: {
                    userId,
                    type: { $exists: false },
                  },
                },
                { $match: { $expr: { $eq: ['$_id', '$$categoryId'] } } },
              ],
              as: 'c',
            },
          },
          { $match: { c: { $size: { $gt: 0 } } } },
          { $project: { _id: 1 } },
        ])

        await DbItemModel.deleteMany({ _id: { $in: its.map((it) => it._id) } })
        reply.status(201).send()
      }
    )
  }
}
