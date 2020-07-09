import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { checkAuthorize } from '@/util/api'
import {
  ensureSchema,
  sAnyObject,
  sCardType,
  sId,
  sIdJoinedComma,
  sListStringNonEmpty,
  sSort,
  sStringNonEmpty,
} from '@/util/schema'

import { zhDictionary } from '../db/local'
import { DbCardModel } from '../db/mongo'
import { reduceToObj, restoreDate } from '../util'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['card']

  queryCard()
  createCard()
  updateCard()
  deleteCard()

  next()

  /**
   * TODO: enable non-validated JSON only in development
   * @deprecated
   */
  function queryCard() {
    const sBody = S.shape({
      cond: sAnyObject.optional(),
      select: sListStringNonEmpty,
      sort: sSort.optional(),
      offset: S.integer().minimum(0).optional(),
      limit: S.enum(S.null(), S.integer().minimum(1)),
      join: sListStringNonEmpty.optional(),
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
          join = [],
          hasCount = true,
        } = ensureSchema(sBody, req.body)

        const match = [
          { $match: { userId } },
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
            { $sort: reduceToObj(sort as [string, any][]) },
            { $skip: offset },
            ...(limit ? [{ $limit: limit }] : []),
            {
              $project: Object.assign(
                { _id: 0 },
                reduceToObj(select.map((k) => [k, 1]))
              ),
            },
          ]),
          hasCount
            ? DbCardModel.aggregate([...match, { $count: 'count' }])
            : undefined,
        ])

        return ensureSchema(sResponse, {
          result: rData,
          count: hasCount ? (rCount[0] || {}).count || 0 : undefined,
        })
      }
    )
  }

  function createCard() {
    const sQuery = S.shape({
      item: sStringNonEmpty,
      type: sCardType,
    })

    f.put<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Create a card',
          querystring: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { item, type } = req.query

        /**
         * TODO: dynamic directions based on existing directions in the database
         */
        const directions = ['se', 'ec']

        if (type === 'vocab') {
          const r = zhDictionary.count({
            $or: [
              {
                alt: item,
              },
              {
                entry: item,
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
              userId,
              item,
              type,
              direction,
            })
          )
        )

        reply.status(201).send()
      }
    )
  }

  function updateCard() {
    const sQuery = S.shape({
      id: sId,
    })

    const sBody = S.shape({
      set: sAnyObject,
    })

    /**
     * TODO: body needs full validation
     */
    f.patch<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Update a card',
          querystring: sQuery.valueOf(),
          body: sBody.valueOf(),
        },
      },
      async (req, reply) => {
        const { id } = req.query
        const { set } = ensureSchema(sBody, req.body)

        await DbCardModel.findByIdAndUpdate(id, {
          $set: set,
        })

        reply.status(201).send()
      }
    )
  }

  function deleteCard() {
    const sQuery = S.shape({
      id: sIdJoinedComma,
    })

    f.delete<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Delete a card',
          querystring: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { id } = req.query
        await DbCardModel.purgeMany(userId, { _id: { $in: id.split(',') } })

        reply.status(201).send()
      }
    )
  }
}
