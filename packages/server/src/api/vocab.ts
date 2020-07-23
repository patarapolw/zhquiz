import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { zhSentence, zhVocab } from '../db/local'
import { DbCardModel } from '../db/mongo'

export default (f: FastifyInstance, _: any, next: () => void) => {
  f.post(
    '/q',
    {
      schema: {
        tags: ['vocab'],
        summary: 'Query for a given vocab',
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
                  required: ['simplified', 'pinyin', 'english'],
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
      const { entry, offset = 0, limit = 10 } = req.body

      return {
        result: zhVocab
          .find({
            $or: [
              { simplified: { $contains: entry } },
              { traditional: { $contains: entry } },
            ],
          })
          .sort(({ frequency: f1 = 0 }, { frequency: f2 = 0 }) => f2 - f1)
          .slice(offset, limit ? offset + limit : undefined)
          .map(({ simplified, traditional, pinyin, english }) => {
            return { simplified, traditional, pinyin, english }
          }),
        count: zhVocab.count({
          $or: [
            { simplified: { $contains: entry } },
            { traditional: { $contains: entry } },
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
        tags: ['vocab'],
        summary: 'Get translation for a given vocab',
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
                type: 'object',
                properties: {
                  vocabs: {
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
                  sentences: {
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
      },
    },
    async (req) => {
      const { entry } = req.body

      return {
        result: {
          vocabs: zhVocab
            .find({
              $or: [{ simplified: entry }, { traditional: entry }],
            })
            .map(({ simplified, traditional, pinyin, english }) => {
              return { simplified, traditional, pinyin, english }
            }),
          sentences: zhSentence
            .chain()
            .find({
              chinese: { $contains: entry },
            })
            .simplesort('priority', true)
            .data()
            .slice(0, 10)
            .map(({ chinese, pinyin, english }) => {
              return { chinese, pinyin, english }
            }),
        },
      }
    }
  )

  f.post(
    '/random',
    {
      schema: {
        tags: ['vocab'],
        summary: 'Randomize a vocab for a given level',
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

      const { levelMin, level } = req.body
      const vMap = new Map<string, number>()
      zhVocab
        .find({
          $and: [{ level: { $lte: level } }, { level: { $gte: levelMin } }],
        })
        .map(({ simplified, level }) => {
          if (level) {
            vMap.set(simplified, level)
          }
        })

      const reviewing = new Set<string>(
        (
          await DbCardModel.aggregate([
            {
              $match: {
                userId: u._id,
                item: { $in: Array.from(vMap.keys()) },
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

      const vs = Array.from(vMap).filter(([h]) => !reviewing.has(h))
      if (vs.length === 0) {
        return {}
      }

      const [v, lv] = vs[Math.floor(Math.random() * vs.length)] || {}

      const r =
        zhVocab.findOne({
          simplified: v,
          // @ts-ignore
          english: { $exists: true },
        }) || ({} as any)

      return {
        result: v,
        english: r.english,
        level: lv,
      }
    }
  )

  f.get(
    '/level',
    {
      schema: {
        tags: ['vocab'],
        summary: 'Get all leveled vocabs',
        response: {
          200: S.shape({
            result: S.list(
              S.shape({
                entry: S.string(),
                level: S.integer().optional(),
                srsLevel: S.integer().optional(),
              })
            ),
          }),
        },
      },
    },
    async (req, reply) => {
      const u = req.session.user
      if (!u || !u._id) {
        reply.status(401).send()
        return
      }

      const vMap = new Map<string, number>()
      zhVocab.find({}).map(({ simplified, level }) => {
        if (level) {
          vMap.set(simplified, level)
        }
      })

      const r = await DbCardModel.aggregate([
        {
          $match: {
            userId: u._id,
            item: {
              $in: Array.from(vMap.keys()),
            },
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
          $project: {
            _id: 0,
            entry: '$item',
            srsLevel: { $ifNull: [{ $max: '$q.srsLevel' }, -1] },
          },
        },
      ])

      const srsLevelMap = new Map<string, number>()
      r.map(({ entry, srsLevel }) => {
        srsLevelMap.set(entry, srsLevel)
      })

      return {
        result: Array.from(vMap).map(([entry, level]) => ({
          entry,
          level,
          srsLevel: srsLevelMap.get(entry),
        })),
      }
    }
  )

  next()
}
