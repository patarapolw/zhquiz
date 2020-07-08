import { FastifyInstance } from 'fastify'

import { hsk, zhToken } from '../db/local'
import { DbCardModel } from '../db/mongo'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['hanzi']

  f.post(
    '/match',
    {
      schema: {
        tags,
        summary: 'Get data for a given Hanzi',
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
              sup: { type: 'string' },
              sub: { type: 'string' },
              variants: { type: 'string' },
              pinyin: { type: 'string' },
              english: { type: 'string' },
            },
          },
        },
      },
    },
    async (req) => {
      const { q, select } = req.body
      const r = zhToken.findOne({ entry: q }) || ({} as any)

      return (select as string[]).reduce(
        (prev, k) => ({ ...prev, [k]: r[k] }),
        {} as Record<string, any>
      )
    }
  )

  f.post(
    '/random',
    {
      schema: {
        tags,
        summary: 'Randomize a Hanzi for a given level',
        body: {
          type: 'object',
          properties: {
            cond: {
              type: 'object',
              properties: {
                level: {
                  anyOf: [
                    { type: 'integer' },
                    {
                      type: 'array',
                      items: [{ type: 'integer' }, { type: 'integer' }],
                    },
                  ],
                },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              result: { type: 'string' },
              english: { type: 'string' },
              level: { type: 'integer' },
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

      const { cond: { level } = {} as any } = req.body
      const [lvMin, lvMax] = Array.isArray(level) ? level : [1, level || 60]

      const hsMap = new Map<string, number>()

      Object.entries(hsk)
        .map(([lv, vs]) => ({ lv: parseInt(lv), vs }))
        .filter(({ lv }) => lv <= lvMax && lv >= lvMin)
        .map(({ lv, vs }) => {
          vs.map((v) => {
            v.split('').map((h) => {
              const hLevel = hsMap.get(h)
              if (!hLevel || hLevel > lv) {
                hsMap.set(h, lv)
              }
            })
          })
        })

      const reviewing = new Set<string>(
        (
          await DbCardModel.aggregate([
            {
              $match: {
                userId: u._id,
                item: { $in: Array.from(hsMap.keys()) },
                type: 'hanzi',
              },
            },
            {
              $lookup: {
                from: 'quiz',
                localField: '_id',
                foreignField: 'cardId',
                as: 'q',
              },
            },
            {
              $match: { 'q.nextReview': { $exists: true } },
            },
            {
              $project: {
                _id: 0,
                item: 1,
              },
            },
          ])
        ).map((el) => el.item)
      )

      const hs = Array.from(hsMap).filter(([h]) => !reviewing.has(h))
      if (hs.length === 0) {
        return {}
      }

      const [h, lv] = hs[Math.floor(Math.random() * hs.length)]

      const r = zhToken.findOne({ entry: h })

      return {
        result: h,
        english: r ? r.english : undefined,
        level: lv,
      }
    }
  )

  next()
}
