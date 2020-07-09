import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { checkAuthorize } from '@/util/api'
import {
  ensureSchema,
  sCardType,
  sId,
  sIdJoinedComma,
  sStringNonEmpty,
} from '@/util/schema'

import { DbCardModel, DbQuizModel } from '../db/mongo'
import { reduceToObj } from '../util'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['quiz']

  quizInfo()
  quizGetIds()
  quizRight()
  quizWrong()
  quizRepeat()

  next()

  function quizInfo() {
    const sQuery = S.shape({
      id: sId,
      select: sStringNonEmpty,
    })

    const sResponse = S.shape({
      front: S.string(),
      back: S.string().optional(),
      mnemonic: S.string(),
    })

    f.post<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Get card info for quiz',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req) => {
        const { id, select } = req.query
        const r =
          (await DbCardModel.findById(id).select(
            Object.assign(
              { _id: 0 },
              reduceToObj(select.split(',').map((k) => [k, 1]))
            )
          )) || ({} as any)

        return r
      }
    )
  }

  function quizGetIds() {
    const sQuery = S.shape({
      q: sStringNonEmpty,
      type: sCardType,
    })

    const sResponse = S.shape({
      result: sIdJoinedComma,
    })

    f.post<typeof sQuery.type>(
      '/ids',
      {
        schema: {
          tags,
          summary: 'Get quiz ids for a card',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { q, type } = ensureSchema(sQuery, req.query)

        const rs = await DbCardModel.aggregate([
          {
            $match: {
              userId,
              item: q,
              type,
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
          { $unwind: { path: '$q', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              quizId: '$q._id',
            },
          },
        ])

        return {
          result: rs.map((r) => r.quizId),
        }
      }
    )
  }

  function quizRight() {
    const sQuery = S.shape({
      id: sId,
    })

    f.patch<typeof sQuery.type>(
      '/right',
      {
        schema: {
          tags,
          summary: 'Mark card as right',
          body: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const { id } = ensureSchema(sQuery, req.query)

        const quiz = await DbQuizModel.findOne({ _id: id })
        if (!quiz) {
          reply.status(404).send('no matching quizId')
          return
        }

        quiz.markRight()
        await quiz.save()

        reply.status(201).send()
      }
    )
  }

  function quizWrong() {
    const sQuery = S.shape({
      id: sId,
    })

    f.patch<typeof sQuery.type>(
      '/wrong',
      {
        schema: {
          tags,
          summary: 'Mark card as wrong',
          querystring: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const { id } = ensureSchema(sQuery, req.query)

        const quiz = await DbQuizModel.findOne({ _id: id })
        if (!quiz) {
          reply.status(404).send('no matching quizId')
          return
        }

        quiz.markWrong()
        await quiz.save()

        reply.status(201).send()
      }
    )
  }

  function quizRepeat() {
    const sQuery = S.shape({
      id: sId,
    })

    f.patch<typeof sQuery.type>(
      '/repeat',
      {
        schema: {
          tags,
          summary: 'Mark card as repeat',
          querystring: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const { id } = ensureSchema(sQuery, req.query)

        const quiz = await DbQuizModel.findOne({ _id: id })
        if (!quiz) {
          reply.status(404).send('no matching quizId')
          return
        }

        quiz.markRepeat()
        await quiz.save()

        reply.status(201).send()
      }
    )
  }
}
