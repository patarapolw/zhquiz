import makePinyin from 'chinese-to-pinyin'
import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { sDictType, zhDict } from '@/db/local'
import { DbExtraModel, sDbExtra, sDbExtraCreate } from '@/db/mongo'
import { checkAuthorize } from '@/util/api'
import { sId, sSort, sStringNonEmpty } from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
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
      existing: S.shape({
        type: sDictType,
        entry: S.string(),
      }).optional(),
      _id: sId.optional(),
    })

    f.put<{
      Body: typeof sBody.type
    }>(
      '/',
      {
        schema: {
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

        const existing = zhDict.vocab.findOne({
          $or: [{ entry }, { alt: { $in: entry } }],
        })
        if (existing) {
          return {
            existing: {
              type: 'vocab',
              entry: existing.entry,
            },
          }
        }
        const isExisting = (t: 'hanzi' | 'sentence') =>
          zhDict[t].by('entry', entry) ? t : null
        const existingType = isExisting('hanzi') || isExisting('sentence')

        if (existingType) {
          return {
            existing: {
              type: existingType,
              entry,
            },
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
      id: S.anyOf(sId, S.list(sId).minItems(1)),
      set: sDbExtra,
    })

    f.patch<{
      Body: typeof sBody.type
    }>(
      '/',
      {
        schema: {
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
      id: sId,
    })

    f.delete<{
      Querystring: typeof sQuery.type
    }>(
      '/',
      {
        schema: {
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
