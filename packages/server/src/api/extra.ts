import makePinyin from 'chinese-to-pinyin'
import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { zhDictionary } from '@/db/local'
import { DbExtraModel, sDbExtra, sDbExtraCreate } from '@/db/mongo'
import { checkAuthorize } from '@/util/api'
import { sDictionaryType, sSort, sStringNonEmpty } from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['extra']

  getQ()
  getMatch()
  doCreate()
  doUpdate()
  doDelete()

  next()

  function getQ() {
    const sQuery = S.shape({
      select: S.list(S.string()).minItems(1),
      sort: S.list(sSort(['entry', 'reading', 'english', 'updatedAt']))
        .minItems(1)
        .optional(),
      page: S.integer().minimum(1),
      perPage: S.integer().minimum(10).optional(),
    })

    const sResponse = S.shape({
      result: S.list(sDbExtra),
      count: S.integer().optional(),
    })

    f.get<typeof sQuery.type>(
      '/q',
      {
        schema: {
          tags,
          summary: 'Query for user-created items',
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
          select,
          sort = ['-updatedAt'],
          page = 1,
          perPage = 10,
        } = req.query
        const offset = (page - 1) * perPage

        const result = await DbExtraModel.find({
          userId,
        })
          .sort(sort.join(' '))
          .select(select.join(' '))
          .skip(offset)
          .limit(perPage)

        const count = await DbExtraModel.countDocuments({ userId })

        return {
          result,
          count,
        }
      }
    )
  }

  function getMatch() {
    const sQuery = S.shape({
      entry: sStringNonEmpty,
      select: S.list(S.string()).minItems(1),
    })

    const sResponse = sDbExtra

    f.get<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Get data for a given user-created item',
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

        const { entry, select } = req.query
        const r = await DbExtraModel.findOne({
          userId,
          entry,
        }).select(select.join(' '))

        return r || {}
      }
    )
  }

  function doCreate() {
    const sBody = sDbExtraCreate

    const sResponse = S.shape({
      existingType: sDictionaryType.optional(),
      _id: S.string().optional(),
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

        const { entry, reading, english } = req.body

        if (
          zhDictionary.count({
            $and: [{ $or: [{ entry }, { alt: entry }] }, { type: 'vocab' }],
          }) > 0
        ) {
          return {
            existingType: 'vocab',
          }
        }

        {
          const existing = zhDictionary.findOne({ entry })
          if (existing) {
            return {
              existingType: existing.type,
            }
          }
        }

        const extra = await DbExtraModel.create({
          userId,
          entry,
          reading: reading || makePinyin(entry, { keepRest: true }),
          english,
        })

        return {
          _id: extra._id,
        }
      }
    )
  }

  function doUpdate() {
    const sBody = S.shape({
      id: S.anyOf(S.string(), S.list(S.string()).minItems(1)),
      set: sDbExtra,
    })

    f.patch<any, any, any, typeof sBody.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Update user-created items',
          body: {
            type: 'object',
            required: ['ids', 'set'],
            properties: {
              ids: { type: 'array', items: { type: 'string' } },
              set: { type: 'object' },
            },
          },
        },
      },
      async (req, reply): Promise<void> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { id, set } = req.body

        await DbExtraModel.updateMany(
          { _id: { $in: Array.isArray(id) ? id : [id] } },
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
      id: S.string(),
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
      async (req, reply): Promise<void> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { id } = req.query

        await DbExtraModel.purgeMany(userId, {
          _id: id,
        })

        reply.status(201).send()
      }
    )
  }
}
