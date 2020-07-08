import makePinyin from 'chinese-to-pinyin'
import { FastifyInstance } from 'fastify'

import { hsk, zhVocab } from '../db/local'
import { DbCardModel } from '../db/mongo'
import { pickObj } from '../util'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['vocab']

  f.post(
    '/q',
    {
      schema: {
        tags,
        summary: 'Query for a given vocab',
        body: {
          type: 'object',
          required: ['q', 'select'],
          properties: {
            q: { type: 'string' },
            select: { type: 'array', minItems: 1, items: { type: 'string' } },
            offset: { type: 'integer' },
            limit: { type: 'integer' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              result: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    simplified: { type: 'string' },
                    traditional: { type: 'string' },
                    pinyin: { type: 'string' },
                    english: { type: 'string' },
                  },
                },
              },
              count: { type: 'integer' },
              offset: { type: 'integer' },
              limit: { type: 'integer' },
            },
          },
        },
      },
    },
    async (req) => {
      const { q, select, offset = 0, limit = 10 } = req.body

      return {
        result: zhVocab
          .find({
            $or: [
              { simplified: { $contains: q } },
              { traditional: { $contains: q } },
            ],
          })
          .sort(({ frequency: f1 = 0 }, { frequency: f2 = 0 }) => f2 - f1)
          .slice(offset, limit ? offset + limit : undefined)
          .map(({ simplified, traditional, pinyin, english }) => {
            if (select.includes('pinyin') && !pinyin) {
              pinyin = makePinyin(simplified, { keepRest: true })
            }

            return pickObj({ simplified, traditional, pinyin, english }, select)
          }),
        count: zhVocab.count({
          $or: [
            { simplified: { $contains: q } },
            { traditional: { $contains: q } },
          ],
        }),
        offset,
        limit,
      }
    }
  )

  f.post(
    '/match',
    {
      schema: {
        tags,
        summary: 'Get translation for a given vocab',
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
              result: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    simplified: { type: 'string' },
                    traditional: { type: 'string' },
                    pinyin: { type: 'string' },
                    english: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (req) => {
      const { q, select } = req.body

      return {
        result: zhVocab
          .find({
            $or: [{ simplified: q }, { traditional: q }],
          })
          .map(({ simplified, traditional, pinyin, english }) => {
            if (select.includes('pinyin') && !pinyin) {
              pinyin = makePinyin(simplified, { keepRest: true })
            }

            return pickObj({ simplified, traditional, pinyin, english }, select)
          }),
      }
    }
  )

  f.post(
    '/random',
    {
      schema: {
        tags,
        summary: 'Randomize a vocab for a given level',
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

      let vs = Object.entries(hsk)
        .map(([lv, vs]) => ({ lv: parseInt(lv), vs }))
        .filter(({ lv }) => lv <= lvMax && lv >= lvMin)
        .reduce(
          (prev, { lv, vs }) => [...prev, ...vs.map((v) => ({ v, lv }))],
          [] as {
            v: string
            lv: number
          }[]
        )

      const reviewing = new Set<string>(
        (
          await DbCardModel.aggregate([
            {
              $match: {
                userId: u._id,
                item: { $in: vs.map(({ v }) => v) },
                type: 'vocab',
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

      vs = vs.filter(({ v }) => !reviewing.has(v))
      if (vs.length === 0) {
        return {}
      }

      const v = vs[Math.floor(Math.random() * vs.length)] || {}

      const r =
        zhVocab.findOne({
          simplified: v.v,
          // @ts-ignore
          english: { $exists: true },
        }) || ({} as any)

      return {
        result: v.v,
        english: r.english,
        level: v.lv,
      }
    }
  )

  f.get(
    '/all',
    {
      schema: {
        tags,
        summary: 'Get all leveled vocabs',
        response: {
          200: {
            type: 'object',
            additionalProperties: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
    async () => {
      return hsk
    }
  )

  next()
}
