import makePinyin from 'chinese-to-pinyin'
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
  DbTemplateModel,
  sDbItemExportPartial,
  sDbItemExportSelect,
} from '@/db/mongo'
import { checkAuthorize } from '@/util/api'
import { safeString } from '@/util/mongo'
import { sDictionaryType, sId, sLang, sSort } from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['item']
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
      q: S.string().optional(),
      select: S.list(sDbItemExportSelect).minItems(1),
      page: S.integer().minimum(1).optional(),
      perPage: S.integer().minimum(5).optional(),
      limit: S.integer().minimum(-1).optional(),
      sort: S.list(mySort).optional(),
    })

    const sResponse = S.shape({
      result: S.list(sDbItemExportPartial),
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
      async (req, reply): Promise<typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return undefined as any
        }

        const {
          q,
          page,
          perPage,
          limit,
          select,
          sort = ['-updatedAt'],
        } = req.query

        if (q) {
          await DbItemModel.find({ entry: safeString(q) })
            .select('_id templateId')
            .then(async (its) => {
              if (its.length) {
                return Promise.all(
                  its.map(({ _id: itemId, templateId }) => {
                    return DbTemplateModel.find({
                      _id: templateId,
                      userId,
                      langFrom: 'chinese',
                      langTo: 'english',
                      type: { $exists: false },
                    })
                  })
                )
              }

              return {
                result: [],
              }
            })
        }

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
                  $sort: sort.reduce((prev, k) => {
                    if (k.startsWith('-')) {
                      prev[k.substr(1)] = -1
                    } else {
                      prev[k] = 1
                    }

                    return prev
                  }, {} as Record<string, -1 | 1>),
                },
                ...(page && perPage ? [{ $skip: (page - 1) * perPage }] : []),
                ...((perPage || limit) && limit !== -1
                  ? [{ $limit: perPage || limit }]
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
          result: (r[0] || {}).result || [],
          count: page
            ? (((r[0] || {}).count || [])[0] || {}).count || 0
            : undefined,
        }
      }
    )
  }

  function doCreate() {
    const sQuery = S.shape({
      lang: sLang.optional(),
    })

    const sBody = sDbItemExportPartial.required('entry')

    const sResponse = S.shape({
      type: S.anyOf(sDictionaryType, S.null()),
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
      async (req, reply): Promise<typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return undefined as any
        }

        const { lang = [] } = req.query
        const [langFrom = 'chinese', langTo = 'english'] = lang

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
                    langFrom,
                    langTo,
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
            type: (existing[0].type || [])[0],
          }
        }

        const template = await DbCategoryModel.aggregate([
          {
            $match: {
              userId: {
                $in: [userId, 'shared', 'default'],
              },
              type: { $exists: false },
              langFrom,
              langTo,
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
          reply.status(500).send({
            error:
              'Cannot create item due to lack of templating for quiz. Please contact the admin.',
          })
          return undefined as any
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

        return {
          type: null,
        }
      }
    )
  }

  function doUpdate() {
    const sQuery = S.shape({
      id: sId.optional(),
    })

    const sBody = S.shape({
      ids: S.list(sId).minItems(1).optional(),
      set: sDbItemExportPartial,
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
        const userId = checkAuthorize(req, reply, {})
        if (!userId) {
          return
        }

        const { id } = req.query
        const { ids = [id], set } = req.body

        if (!ids[0]) {
          reply.status(304).send()
          return
        }

        await DbItemModel.updateMany(
          { _id: { $in: ids.filter((id) => id).map((id) => id!) } },
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
        const userId = checkAuthorize(req, reply, {})
        if (!userId) {
          return
        }

        const { id } = req.query

        const its = await _getUserItem<{
          _id: string
        }>({
          preConds: [{ $match: { _id: id } }],
          postConds: [{ $project: { _id: 1 } }],
          userId,
        })

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
    const sBody = S.shape({
      ids: S.list(sId).minItems(1),
    })

    f.post<DefaultQuery, DefaultParams, DefaultHeaders, typeof sBody.type>(
      '/delete/ids',
      {
        schema: {
          tags,
          summary: 'Delete user-created items',
          body: sBody.valueOf(),
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply, {})
        if (!userId) {
          return
        }

        const { ids } = req.body

        const its = await _getUserItem<{
          _id: string
        }>({
          preConds: [{ $match: { _id: { $in: ids } } }],
          postConds: [{ $project: { _id: 1 } }],
          userId,
        })

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
      entry: S.string(),
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
        const userId = checkAuthorize(req, reply, {})
        if (!userId) {
          return
        }

        const { entry } = req.query
        const its = await _getUserItem<{
          _id: string
        }>({
          preConds: [{ $match: { entry: safeString(entry) } }],
          postConds: [{ $project: { _id: 1 } }],
          userId,
        })

        await DbItemModel.deleteMany({ _id: { $in: its.map((it) => it._id) } })
        reply.status(201).send()
      }
    )
  }

  async function _getUserItem<T>(o: {
    preConds: any[]
    postConds: any[]
    userId: string
  }) {
    return (await DbItemModel.aggregate([
      ...o.preConds,
      {
        $lookup: {
          from: 'category',
          let: {
            categoryId: '$categoryId',
          },
          pipeline: [
            {
              $match: {
                userId: o.userId,
                type: { $exists: false },
              },
            },
            { $match: { $expr: { $eq: ['$_id', '$$categoryId'] } } },
          ],
          as: 'c',
        },
      },
      { $match: { c: { $size: { $gt: 0 } } } },
      ...o.postConds,
    ])) as T[]
  }
}
