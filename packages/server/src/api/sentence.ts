import makePinyin from 'chinese-to-pinyin'
import { FastifyInstance } from 'fastify'

import { zhSentence } from '../db/local'
import { DbCardModel } from '../db/mongo'

export default (f: FastifyInstance, _: any, next: () => void) => {
  f.post(
    '/match',
    {
      schema: {
        tags: ['sentence'],
        summary: 'Get sentence data',
        body: {
          type: 'object',
          required: ['entry'],
          properties: {
            entry: { type: 'string' },
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
      const { entry } = req.body

      return {
        result: zhSentence
          .chain()
          .find({
            chinese: entry,
          })
          .simplesort('priority', true)
          .data()
          .map(({ chinese, pinyin, english }) => {
            return { chinese, pinyin, english }
          }),
      }
    }
  )

  f.post(
    '/q',
    {
      schema: {
        tags: ['sentence'],
        summary: 'Query for a given sentence',
        body: {
          type: 'object',
          required: ['entry'],
          properties: {
            entry: { type: 'string' },
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
                  required: ['chinese', 'english'],
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
      const { entry, offset = 0, limit = 10 } = req.body

      return {
        result: zhSentence
          .chain()
          .find({
            chinese: { $contains: entry },
          })
          .simplesort('priority', true)
          .data()
          .slice(offset, limit ? offset + limit : undefined)
          .map(({ chinese, pinyin, english }) => {
            if (!pinyin) {
              pinyin = makePinyin(entry, { keepRest: true })
            }

            return { chinese, pinyin, english }
          }),
        count: zhSentence.count({
          chinese: { $contains: entry },
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
        tags: ['sentence'],
        summary: 'Randomize a sentence for a given level',
        body: {
          type: 'object',
          properties: {
            level: { type: 'integer' },
            levelMin: { type: 'integer' },
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

      const { levelMin, level } = req.body
      const getSentence = (type: any) => {
        const ss = zhSentence.find({
          $and: [
            { level: { $lte: level || 60 } },
            { level: { $gte: levelMin || 1 } },
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
