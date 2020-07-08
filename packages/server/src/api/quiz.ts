import { FastifyInstance } from 'fastify'

import { DbCardModel, DbQuizModel } from '../db/mongo'
import { reduceToObj } from '../util'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['quiz']

  f.post(
    '/',
    {
      schema: {
        tags,
        summary: 'Get card info for quiz',
        body: {
          type: 'object',
          required: ['id', 'select'],
          properties: {
            id: { type: 'string' },
            select: { type: 'array', items: { type: 'string' }, minItems: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              front: { type: 'string' },
              back: { type: 'string' },
              mnemonic: { type: 'string' },
            },
          },
        },
      },
    },
    async (req) => {
      const { id, select } = req.body
      const r =
        (await DbCardModel.findById(id).select(
          Object.assign(
            { _id: 0 },
            reduceToObj((select as string[]).map((k) => [k, 1]))
          )
        )) || ({} as any)

      return r
    }
  )

  f.patch(
    '/right',
    {
      schema: {
        tags,
        summary: 'Mark card as right',
        body: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.body

      let quiz = await DbQuizModel.findOne({ cardId: id })
      if (!quiz) {
        quiz = await DbQuizModel.create({ cardId: id })
      }

      quiz.markRight()
      await quiz.save()

      reply.status(201).send()
    }
  )

  f.patch(
    '/wrong',
    {
      schema: {
        tags,
        summary: 'Mark card as wrong',
        body: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.body

      let quiz = await DbQuizModel.findOne({ cardId: id })
      if (!quiz) {
        quiz = await DbQuizModel.create({ cardId: id })
      }

      quiz.markWrong()
      await quiz.save()

      reply.status(201).send()
    }
  )

  f.patch(
    '/repeat',
    {
      schema: {
        tags,
        summary: 'Mark card as repeat',
        body: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.body

      let quiz = await DbQuizModel.findOne({ cardId: id })
      if (!quiz) {
        quiz = await DbQuizModel.create({ cardId: id })
      }

      quiz.markRepeat()
      await quiz.save()

      reply.status(201).send()
    }
  )

  next()
}
