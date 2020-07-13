import {
  DefaultHeaders,
  DefaultParams,
  DefaultQuery,
  FastifyInstance,
} from 'fastify'
import S from 'jsonschema-definer'

import {
  DbTemplateModel,
  sDbCategoryExportPartial,
  sDbTemplateExportPartial,
  sDbTemplateExportSelect,
} from '@/db/mongo'
import { reduceToObj } from '@/util'
import { checkAuthorize } from '@/util/api'
import { sId } from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['template']

  getById()
  postGetByIds()

  next()

  function getById() {
    const sQuery = S.shape({
      id: sId,
      select: S.list(sDbTemplateExportSelect).minItems(1),
    })

    const sResponse = S.shape({
      result: sDbCategoryExportPartial.optional(),
    })

    f.get<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Get template by id',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return undefined as any
        }

        const { id, select } = req.query

        const [r] = await DbTemplateModel.aggregate([
          { $match: { _id: id } },
          {
            $lookup: {
              from: 'category',
              let: {
                categoryId: '$categoryId',
              },
              pipeline: [
                {
                  $match: {
                    userId: {
                      $in: [userId, 'shared', 'default'],
                    },
                  },
                },
                { $match: { $expr: { $eq: ['$_id', '$$categoryId'] } } },
              ],
              as: 'c',
            },
          },
          { $match: { c: { $size: { $gt: 0 } } } },
          {
            $project: Object.assign(
              { _id: 0 },
              reduceToObj(select.map((k) => [k, 1]))
            ),
          },
        ])

        return r || null
      }
    )
  }

  function postGetByIds() {
    const sBody = S.shape({
      ids: S.list(sId).minItems(1),
      select: S.list(sDbTemplateExportSelect).minItems(1),
    })

    const sResponse = S.shape({
      result: S.list(sDbTemplateExportPartial),
    })

    f.post<DefaultQuery, DefaultParams, DefaultHeaders, typeof sBody.type>(
      '/ids',
      {
        schema: {
          tags,
          summary: 'Get template by ids via POST',
          body: sBody.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return undefined as any
        }

        const { ids, select } = req.body

        const rs = await DbTemplateModel.aggregate([
          { $match: { _id: { $in: ids } } },
          {
            $lookup: {
              from: 'category',
              let: {
                categoryId: '$categoryId',
              },
              pipeline: [
                {
                  $match: {
                    userId: {
                      $in: [userId, 'shared', 'default'],
                    },
                  },
                },
                { $match: { $expr: { $eq: ['$_id', '$$categoryId'] } } },
              ],
              as: 'c',
            },
          },
          { $match: { c: { $size: { $gt: 0 } } } },
          {
            $project: Object.assign(
              { _id: 0 },
              reduceToObj(select.map((k) => [k, 1]))
            ),
          },
        ])

        return {
          result: rs,
        }
      }
    )
  }
}
