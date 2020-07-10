import dotProp from 'dot-prop-immutable'
import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { DbQuizModel, DbTemplateModel } from '@/db/mongo'
import { reduceToObj, restoreDate } from '@/util'
import { checkAuthorize } from '@/util/api'
import {
  ensureSchema,
  sCardType,
  sId,
  sIdJoinedComma,
  sJoinedComma,
  sListStringNonEmpty,
  sSort,
  sStringNonEmpty,
} from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['quiz']

  quizRenderInfo()
  quizGetIds()
  quizRight()
  quizWrong()
  quizRepeat()
  quizUpdateSet()
  quizCreate()
  quizDelete()

  // if (process.env.NODE_ENV === 'development') {
  quizQuery()
  // }

  next()

  function quizRenderInfo() {
    const sQuery = S.shape({
      id: sId,
      select: sJoinedComma(['front', 'back', 'mnemonic']),
    })

    const sResponse = S.shape({
      front: S.string(),
      back: S.string().optional(),
      mnemonic: S.string(),
    })

    f.post<typeof sQuery.type>(
      '/render',
      {
        schema: {
          tags,
          summary: 'Get render info for quiz',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req) => {
        const { id, select } = req.query
        const r =
          (await DbQuizModel.findById(id).select(
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
      result: S.list(sId),
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
      async (req, reply): Promise<undefined | typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { q, type } = ensureSchema(sQuery, req.query)

        const rs = await DbQuizModel.aggregate([
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

  /**
   * @deprecated
   */
  function quizQuery() {
    const sBody = S.shape({
      cond: S.object().optional(),
      select: sListStringNonEmpty,
      sort: sSort(['updatedAt']).optional(),
      offset: S.integer().minimum(0).optional(),
      limit: S.enum(S.null(), S.integer().minimum(1)),
      hasCount: S.boolean().optional(),
    })

    const sResponse = S.shape({
      result: S.list(S.object().additionalProperties(true)),
      count: S.integer().minimum(0).optional(),
    })

    f.post(
      '/q',
      {
        schema: {
          tags,
          summary: 'Query for cards',
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

        const {
          cond = {},
          select,
          sort = [['updatedAt', -1]],
          offset = 0,
          limit = 10,
          hasCount = true,
        } = ensureSchema(sBody, req.body)

        const r = await DbQuizModel.aggregate([
          { $match: { userId } },
          { $match: restoreDate(cond) },
          {
            $facet: {
              result: [
                { $sort: reduceToObj(sort as [string, any][]) },
                { $skip: offset },
                ...(limit ? [{ $limit: limit }] : []),
                {
                  $project: Object.assign(
                    { _id: 0 },
                    reduceToObj(select.map((k) => [k, 1]))
                  ),
                },
              ],
              count: hasCount ? [{ $count: 'count' }] : undefined,
            },
          },
        ])

        return ensureSchema(sResponse, {
          result: r[0]?.result || [],
          count: hasCount
            ? dotProp.get(r[0] || {}, 'count.0.count') || 0
            : undefined,
        })
      }
    )
  }

  function quizCreate() {
    const sQuery = S.shape({
      entry: sStringNonEmpty,
      template: sStringNonEmpty,
    })

    f.put<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Create a quiz item',
          querystring: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { entry, template } = req.query

        const templateIds = (
          await DbTemplateModel.find({ name: template }).select({
            _id: 1,
          })
        ).map((t) => t._id)

        await DbQuizModel.insertMany([
          templateIds.map((templateId) => ({
            userId,
            entry,
            templateId,
          })),
        ])

        reply.status(201).send()
      }
    )
  }

  function quizUpdateSet() {
    const sQuery = S.shape({
      id: sId,
    })

    const sBody = S.shape({
      set: S.shape({
        front: S.string().optional(),
        back: S.string().optional(),
        mnemonic: S.string().optional(),
        tag: sListStringNonEmpty.optional(),
      }),
    })

    f.patch<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Update a quiz item',
          querystring: sQuery.valueOf(),
          body: sBody.valueOf(),
        },
      },
      async (req, reply) => {
        const { id } = req.query
        const { set } = ensureSchema(sBody, req.body)

        await DbQuizModel.findByIdAndUpdate(id, {
          $set: set,
        })

        reply.status(201).send()
      }
    )
  }

  function quizDelete() {
    const sQuery = S.shape({
      id: sIdJoinedComma,
    })

    f.delete<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Delete a quiz item',
          querystring: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { id } = req.query
        await DbQuizModel.deleteMany({ _id: { $in: id.split(',') }, userId })

        reply.status(201).send()
      }
    )
  }
}
