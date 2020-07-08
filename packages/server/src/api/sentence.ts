import makePinyin from 'chinese-to-pinyin'
import { FastifyInstance } from 'fastify'

import { zhSentence } from '../db/local'
import { DbCardModel } from '../db/mongo'
import { pickObj } from '../util'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['sentence']

  const isSimp = (s = '') => {
    const arr = [
      'simplified',
      'simplified-english',
      'traditional',
      'traditional-english',
    ]
    return -(arr.reverse().indexOf(s) + 1) / arr.length
  }

  f.post(
    '/match',
    {
      schema: {
        tags,
        summary: 'Get sentence data',
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
                    chinese: { type: 'string' },
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
        result: zhSentence
          .find({
            chinese: q,
          })
          .sort(({ type: t1 }, { type: t2 }) => {
            return isSimp(t1) - isSimp(t2) + 0.5 - Math.random()
          })
          .map(({ chinese, pinyin, english }) => {
            if (select.includes('pinyin') && !pinyin) {
              pinyin = makePinyin(chinese, { keepRest: true })
            }

            return pickObj({ chinese, pinyin, english }, select)
          }),
      }
    }
  )

  f.post(
    '/q',
    {
      schema: {
        tags,
        summary: 'Query for a given sentence',
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
                    chinese: { type: 'string' },
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
        result: zhSentence
          .find({
            chinese: { $contains: q },
          })
          .sort(({ type: t1 }, { type: t2 }) => {
            return isSimp(t1) - isSimp(t2) + 0.5 - Math.random()
          })
          .slice(offset, limit ? offset + limit : undefined)
          .map(({ chinese, pinyin, english }) => {
            if (select.includes('pinyin') && !pinyin) {
              pinyin = makePinyin(chinese, { keepRest: true })
            }

            return pickObj({ chinese, pinyin, english }, select)
          }),
        count: zhSentence.count({
          chinese: { $contains: q },
        }),
        offset,
        limit,
      }
    }
  )

  f.post(
    '/random',
    {
      schema: {
        tags,
        summary: 'Randomize a sentence for a given level',
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

      const reviewing: string[] = (
        await DbCardModel.aggregate([
          {
            $match: {
              userId: u._id,
              type: 'sentence',
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

      const { cond: { level } = {} as any } = req.body
      const [lvMin, lvMax] = Array.isArray(level) ? level : [1, level || 60]

      const getSentence = (type: any) => {
        const ss = zhSentence.find({
          $and: [
            { level: { $lte: lvMax } },
            { level: { $gte: lvMin } },
            { chinese: { $nin: reviewing } },
            { type },
          ],
        })
        return ss[Math.floor(Math.random() * ss.length)]
      }

      const s =
        getSentence('simplified') ||
        getSentence('traditional') ||
        getSentence({ $nin: ['simplified', 'traditional'] }) ||
        {}

      return {
        result: s.chinese,
        english: s.english,
        level: s.level,
      }
    }
  )

  next()
}
