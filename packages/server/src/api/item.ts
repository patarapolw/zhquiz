import makePinyin from 'chinese-to-pinyin'
import { FastifyInstance } from 'fastify'
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
import { sDictionaryType, sId, sSort } from '@/util/schema'

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

        const offset = page && perPage ? (page - 1) * perPage : 0
        const end =
          (perPage || limit) && limit !== -1
            ? offset + (perPage || limit || 0)
            : undefined

        const itemIds = (
          await DbCategoryModel.find({
            userId,
          })
            .select('_id')
            .then(async (cats) => {
              if (cats.length > 0) {
                return DbItemModel.find({
                  entry: q ? safeString(q) : undefined,
                  categoryId: { $in: cats.map((c) => c._id) },
                })
                  .sort(sort.join(' '))
                  .select('_id')
              }

              return []
            })
        ).map((it) => it._id)

        const resultIds = itemIds.slice(offset, end)
        const rs = (
          await DbItemModel.find({
            _id: {
              $in: resultIds,
            },
          }).select(select.join(' '))
        ).reduce((prev, c) => {
          prev.set(
            c._id,
            select.reduce((o, k) => ({ ...o, [k]: (c as any)[k] }), {} as any)
          )
          return prev
        }, new Map<string, any>())

        return {
          result: resultIds.map((id) => rs.get(id)),
          count: itemIds.length,
        }
      }
    )
  }

  function doCreate() {
    const sBody = sDbItemExportPartial.required('entry')

    const sResponse = S.shape({
      type: S.anyOf(sDictionaryType, S.null()),
    })

    f.put<any, any, any, typeof sBody.type>(
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

        const { entry, reading, translation = [] } = req.body

        const authCats = await DbCategoryModel.find({
          userId: {
            $in: [userId, 'shared', 'default'],
          },
        }).select('_id type')

        if (!authCats.length) {
          reply.status(500).send({
            error: 'No authorized categories found',
          })
          return undefined as any
        }

        if (!authCats.filter((c) => !c.type)) {
          reply.status(500).send({
            error: 'No templating categories found',
          })
          return undefined as any
        }

        const existing = await DbItemModel.aggregate([
          {
            $match: {
              $and: [
                { $or: [{ entry }, { alt: entry }] },
                {
                  categoryId: {
                    $in: authCats.filter((c) => c.type).map((c) => c._id),
                  },
                },
              ],
            },
          },
          {
            $group: {
              _id: '$categoryId',
            },
          },
          {
            $project: {
              _id: 0,
              categoryId: '$_id',
            },
          },
        ])

        if (existing[0]) {
          const existingCatSet = new Set<string>(
            existing.map((ex) => ex.categoryId)
          )

          const vocabCats: any[] = authCats.filter(
            (c) => c.type === 'vocab' && existingCatSet.has(c._id)
          )

          if (vocabCats.length) {
            return {
              type: 'vocab',
            }
          }

          return {
            type:
              authCats.find((c) => c._id === existing[0].categoryId)?.type ||
              null,
          }
        }

        const template = await DbTemplateModel.find({
          categoryId: { $in: authCats.filter((c) => c.type).map((c) => c._id) },
        })
          .sort('-priority')
          .select('-_id categoryId')
          .limit(1)

        await DbItemModel.create({
          categoryId: template[0].categoryId,
          entry,
          reading:
            reading && reading[0]
              ? reading
              : [makePinyin(entry, { keepRest: true })],
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

    f.patch<typeof sQuery.type, any, any, typeof sBody.type>(
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

        const cats = await DbCategoryModel.find({
          userId,
          type: { $exists: false },
        }).select('_id')

        await DbItemModel.deleteOne({
          _id: id,
          categoryId: { $in: cats.map((c) => c._id) },
        })
        reply.status(201).send()
      }
    )
  }

  function postDeleteByIds() {
    const sBody = S.shape({
      ids: S.list(sId).minItems(1),
    })

    f.post<any, any, any, typeof sBody.type>(
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

        const cats = await DbCategoryModel.find({
          userId,
          type: { $exists: false },
        }).select('_id')

        await DbItemModel.deleteOne({
          _id: { $in: ids },
          categoryId: { $in: cats.map((c) => c._id) },
        })
        reply.status(201).send()
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
        const cats = await DbCategoryModel.find({
          userId,
          type: { $exists: false },
        }).select('_id')

        await DbItemModel.deleteOne({
          entry: safeString(entry),
          categoryId: { $in: cats.map((c) => c._id) },
        })

        reply.status(201).send()
      }
    )
  }
}
