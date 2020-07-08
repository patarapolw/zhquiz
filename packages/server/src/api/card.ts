import { FastifyInstance } from 'fastify'

import { zhVocab } from '../db/local'
import { DbCardModel } from '../db/mongo'
import { arrayize, reduceToObj, restoreDate } from '../util'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['card']

  f.post(
    '/q',
    {
      schema: {
        tags,
        summary: 'Query for cards',
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
            join: { type: 'array', items: { type: 'string' } },
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
        join = [] as string[],
        hasCount = true,
      } = req.body

      const match = [
        { $match: { userId: u._id } },
        ...(join.includes('quiz')
          ? [
              {
                $lookup: {
                  from: 'quiz',
                  localField: '_id',
                  foreignField: 'cardId',
                  as: 'q',
                },
              },
              { $unwind: { path: '$q', preserveNullAndEmptyArrays: true } },
              {
                $addFields: {
                  srsLevel: '$q.srsLevel',
                  nextReview: '$q.nextReview',
                  stat: '$q.stat',
                },
              },
            ]
          : []),
        { $match: restoreDate(cond) },
      ]

      const [rData, rCount = []] = await Promise.all([
        DbCardModel.aggregate([
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
          ? DbCardModel.aggregate([...match, { $count: 'count' }])
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

  f.put(
    '/',
    {
      schema: {
        tags,
        summary: 'Create a card',
        body: {
          type: 'object',
          required: ['create'],
          properties: {
            create: {
              type: 'object',
              required: ['item', 'type'],
              properties: {
                item: { type: 'string' },
                type: { type: 'string' },
              },
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
        create: { item, type },
      } = req.body
      const directions = ['se', 'ec']

      if (type === 'vocab') {
        const r = zhVocab.count({
          $or: [
            {
              traditional: item,
            },
            {
              simplified: item,
              traditional: { $exists: true },
            },
          ],
        })

        if (r > 0) {
          directions.push('te')
        }
      }

      await Promise.all(
        directions.map((direction) =>
          DbCardModel.create({
            userId: u._id,
            item,
            type,
            direction,
          })
        )
      )

      reply.status(201).send()
    }
  )

  f.patch(
    '/',
    {
      schema: {
        tags,
        summary: 'Update a card',
        body: {
          type: 'object',
          required: ['id', 'set'],
          properties: {
            id: { type: 'string' },
            set: { type: 'object' },
          },
        },
      },
    },
    async (req, reply) => {
      const { id, set } = req.body

      await DbCardModel.findByIdAndUpdate(id, {
        $set: set,
      })

      reply.status(201).send()
    }
  )

  f.delete(
    '/',
    {
      schema: {
        tags,
        summary: 'Delete a card',
        body: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              anyOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } },
              ],
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

      const { id } = req.body
      await DbCardModel.purgeMany(u._id, { _id: { $in: arrayize<string>(id) } })

      reply.status(201).send()
    }
  )

  next()
}
