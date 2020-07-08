import { FastifyInstance } from 'fastify'

import { zhSentence, zhToken, zhVocab } from '../db/local'
import { DbExtraModel } from '../db/mongo'
import { reduceToObj } from '../util'

export default (f: FastifyInstance, _: any, next: () => void) => {
  f.post(
    '/q',
    {
      schema: {
        tags: ['extra'],
        summary: 'Query for user-created items',
        body: {
          type: 'object',
          required: ['select'],
          properties: {
            cond: { type: 'object' },
            select: { type: 'array', minItems: 1, items: { type: 'string' } },
            sort: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'array',
                items: [{ type: 'string' }, { type: 'integer', enum: [-1, 1] }],
              },
            },
            offset: { type: 'integer' },
            limit: { type: ['integer', 'null'] },
            hasCount: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              result: { type: 'array', items: {} },
              offset: { type: 'integer' },
              limit: { type: ['integer', 'null'] },
              count: { type: 'integer' },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const u = req.session.user
      if (!u || !u._id) {
        reply.status(401).send()
        return
      }

      const {
        cond = {},
        select,
        sort = [['updatedAt', -1]],
        offset = 0,
        limit = 10,
        hasCount = true,
      } = req.body

      const match = [{ $match: { userId: u._id } }, { $match: cond }]

      const [rData, rCount = []] = await Promise.all([
        DbExtraModel.aggregate([
          ...match,
          { $sort: reduceToObj(sort) },
          { $skip: offset },
          ...(limit ? [{ $limit: limit }] : []),
          {
            $project: Object.assign(
              { _id: 0 },
              reduceToObj((select as string[]).map((k) => [k, 1]))
            ),
          },
        ]),
        hasCount
          ? DbExtraModel.aggregate([...match, { $count: 'count' }])
          : undefined,
      ])

      return {
        result: rData,
        offset,
        limit,
        count: hasCount ? (rCount[0] || {}).count || 0 : undefined,
      }
    }
  )

  f.post(
    '/match',
    {
      schema: {
        tags: ['extra'],
        summary: 'Get data for a given user-created item',
        body: {
          type: 'object',
          required: ['q', 'select'],
          properties: {
            q: { type: 'string' },
            select: { type: 'array', minItems: 1, items: { type: 'string' } },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              chinese: { type: 'string' },
              pinyin: { type: 'string' },
              english: { type: 'string' },
            },
          },
        },
      },
    },
    async (req) => {
      const { q, select } = req.body
      const r = (await DbExtraModel.findOne({ chinese: q })) || ({} as any)

      return (select as string[]).reduce(
        (prev, k) => ({ ...prev, [k]: r[k] }),
        {} as Record<string, any>
      )
    }
  )

  f.put(
    '/',
    {
      schema: {
        tags: ['extra'],
        summary: 'Create a user-created item',
        body: {
          type: 'object',
          required: ['create'],
          properties: {
            create: {
              type: 'object',
              required: ['chinese', 'english'],
              properties: {
                chinese: { type: 'string' },
                pinyin: { type: 'string' },
                english: { type: 'string' },
              },
            },
            // select: { type: 'array', minItems: 1, items: { type: 'string' } },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              type: { type: 'string' },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const u = req.session.user
      if (!u || !u._id) {
        reply.status(401).send()
        return
      }

      const { chinese, pinyin, english } = req.body

      if (
        zhVocab.count({
          $or: [{ simplified: chinese }, { traditional: chinese }],
        }) > 0
      ) {
        return {
          type: 'vocab',
        }
      }

      if (zhSentence.count({ chinese }) > 0) {
        return {
          type: 'sentence',
        }
      }

      if (
        zhToken.count({
          entry: chinese,
          // @ts-ignore
          english: { $exists: true },
        })
      ) {
        return {
          type: 'hanzi',
        }
      }

      await DbExtraModel.create({
        userId: u._id,
        chinese,
        pinyin,
        english,
      })

      return {
        type: 'extra',
      }
    }
  )

  f.patch(
    '/',
    {
      schema: {
        tags: ['extra'],
        summary: 'Update user-created items',
        body: {
          type: 'object',
          required: ['id', 'set'],
          properties: {
            id: { type: 'array', items: { type: 'string' } },
            set: { type: 'object' },
          },
        },
      },
    },
    async (req, reply) => {
      const { id, set } = req.body

      await DbExtraModel.updateMany(
        { _id: { $in: id } },
        {
          $set: set,
        }
      )

      reply.status(201).send()
    }
  )

  f.delete(
    '/',
    {
      schema: {
        tags: ['extra'],
        summary: 'Delete user-created items',
        body: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (req, reply) => {
      const u = req.session.user
      if (!u) {
        reply.status(401).send()
        return
      }

      const { id } = req.body
      await DbExtraModel.purgeMany(u._id, { _id: { $in: id } })
      reply.status(201).send()
    }
  )

  next()
}
