import makePinyin from 'chinese-to-pinyin'
import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { zhDict } from '@/db/local'
import { DbExtraModel, sDbExtraExport } from '@/db/mongo'
import { checkAuthorize } from '@/util/api'
import { sId, sQuizType } from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  doCreate()
  doUpdate()
  doDelete()

  next()

  function doCreate() {
    const sBody = S.shape({
      chinese: S.string(),
      pinyin: S.string().optional(),
      english: S.string(),
    })

    const sResponse = S.shape({
      existing: S.shape({
        type: sQuizType,
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

        const { chinese, pinyin, english } = req.body

        {
          const existing = zhDict.vocab.findOne({
            $or: [{ entry: chinese }, { alt: { $in: chinese } }],
          })
          if (existing) {
            return {
              existing: {
                type: 'vocab',
                entry: existing.entry,
              },
            }
          }
        }

        if (chinese.length === 1) {
          const existing = zhDict.hanzi.findOne({
            entry: chinese,
          })
          if (existing) {
            return {
              existing: {
                type: 'hanzi',
                entry: chinese,
              },
            }
          }
        } else {
          const existing = zhDict.sentence.findOne({
            entry: chinese,
          })
          if (existing) {
            return {
              existing: {
                type: 'sentence',
                entry: chinese,
              },
            }
          }
        }

        const extra = await DbExtraModel.create({
          userId,
          chinese,
          pinyin: pinyin || makePinyin(chinese, { keepRest: true }),
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
      set: sDbExtraExport,
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
