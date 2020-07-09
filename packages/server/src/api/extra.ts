import makePinyin from 'chinese-to-pinyin'
import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { checkAuthorize } from '@/util/api'
import {
  ensureSchema,
  sCardType,
  sIdJoinedComma,
  sPageFalsable,
  sStringNonEmpty,
} from '@/util/schema'

import { zhDictionary } from '../db/local'
import { DbExtraModel } from '../db/mongo'
import { reduceToObj } from '../util'

/**
 * TODO: replace 'extra' system with shared library system.
 * TODO: Non-Chinese mode. No Chinese, no pinyin, except in 'chinese.ts'
 */
export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['extra']
  const sExtra = S.shape({
    chinese: S.string(),
    pinyin: S.string().optional(),
    english: S.string(),
  })

  extraAll()
  extraMatch()
  extraCreate()
  extraUpdate()
  extraDelete()

  next()

  function extraAll() {
    const sQuery = S.shape({
      select: sStringNonEmpty.optional(),
      page: sPageFalsable.optional(),
      sort: sStringNonEmpty.optional(),
    })

    const sResponse = S.shape({
      result: S.list(sExtra.partial()),
      count: S.integer().optional(),
    })

    f.post<typeof sQuery.type>(
      '/all',
      {
        schema: {
          tags,
          summary: 'All user-created items',
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
          page: pagination = '',
          select = 'chinese,pinyin,english',
          sort = '-updatedAt',
        } = ensureSchema(sQuery, req.query)

        let hasCount = false
        let page = 1
        let perPage = 10

        if (pagination !== 'false') {
          hasCount = true
          const p = pagination.split(',').map((p) => parseInt(p))
          page = p[0] || page
          perPage = p[1] || perPage
        }

        const [rData, rCount] = await Promise.all([
          DbExtraModel.aggregate([
            { $match: { userId } },
            {
              $sort: sort.split(',').reduce((prev, k) => {
                if (k.startsWith('-')) {
                  prev[k.substr(1)] = -1
                } else {
                  prev[k] = 1
                }

                return prev
              }, {} as Record<string, -1 | 1>),
            },
            { $skip: (page - 1) * perPage },
            { $limit: perPage },
            {
              $project: Object.assign(
                { _id: 0 },
                reduceToObj(select.split(',').map((k) => [k, 1]))
              ),
            },
          ]),
          hasCount ? DbExtraModel.count({ userId }) : undefined,
        ])

        return {
          result: rData,
          count: rCount,
        }
      }
    )
  }

  function extraMatch() {
    const sQuery = S.shape({
      q: sStringNonEmpty,
      select: sStringNonEmpty,
    })

    const sResponse = sExtra.partial()

    f.post<typeof sQuery.type>(
      '/match',
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
      async (req) => {
        const { q, select } = ensureSchema(sQuery, req.query)
        const r = (await DbExtraModel.findOne({ chinese: q })) || ({} as any)

        return select
          .split(',')
          .reduce(
            (prev, k) => ({ ...prev, [k]: r[k] }),
            {} as Record<string, any>
          )
      }
    )
  }

  function extraCreate() {
    const sBody = sExtra

    const sResponse = S.shape({
      type: sCardType,
    })

    f.put(
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

        const { chinese, pinyin = '', english } = ensureSchema(sBody, req.body)

        const existingTypes = zhDictionary
          .find({
            $or: [{ entry: chinese }, { alt: { $containsString: chinese } }],
          })
          .reduce(
            (prev, { type }) => ({ ...prev, [type]: (prev[type] || 0) + 1 }),
            {} as Record<string, number>
          )

        if (existingTypes.vocab) {
          return {
            type: 'vocab',
          }
        }

        if (existingTypes.sentence) {
          return {
            type: 'sentence',
          }
        }

        if (existingTypes.hanzi) {
          return {
            type: 'hanzi',
          }
        }

        await DbExtraModel.create({
          userId,
          chinese,
          pinyin: pinyin.trim() || makePinyin(chinese, { keepRest: true }),
          english,
        })

        return {
          type: 'extra',
        }
      }
    )
  }

  function extraUpdate() {
    const sQuery = S.shape({
      id: sIdJoinedComma,
    })

    const sBody = S.shape({
      set: sExtra.partial(),
    })

    f.patch<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Update user-created items',
          body: sBody.partial(),
        },
      },
      async (req, reply) => {
        const { id } = ensureSchema(sQuery, req.query)
        const { set } = ensureSchema(sBody, req.body)

        await DbExtraModel.updateMany(
          { _id: { $in: id.split(',') } },
          {
            $set: set,
          }
        )

        reply.status(201).send()
      }
    )
  }

  function extraDelete() {
    const sQuery = S.shape({
      id: sIdJoinedComma,
    })

    f.delete<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Delete user-created items',
          querystring: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string', minLength: 1 },
            },
          },
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { id } = ensureSchema(sQuery, req.query)
        await DbExtraModel.purgeMany(userId, { _id: { $in: id.split(',') } })
        reply.status(201).send()
      }
    )
  }
}
