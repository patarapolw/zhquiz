import {
  DefaultHeaders,
  DefaultParams,
  DefaultQuery,
  FastifyInstance,
} from 'fastify'
import S from 'jsonschema-definer'

import { DbTemplateModel } from '@/db/mongo'
import { sId } from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['template']
  // const myTemplatePartial = S.shape({
  //   _id: sId,
  //   categoryId: sId,
  //   front: S.string(),
  //   back: S.string().optional(),
  //   direction: S.string().optional(),
  // })

  getById()
  postGetByIds()

  next()

  function getById() {
    const sQuery = S.shape({
      id: sId,
      select: S.anyOf(S.string(), S.list(S.string())),
    })

    const sResponse = S.anyOf(
      S.shape({
        categoryId: sId,
        front: S.string(),
        back: S.string().optional(),
      }),
      S.null()
    )

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
      async (req): Promise<typeof sResponse.type> => {
        const { id } = req.query

        const r = await DbTemplateModel.findById(id).select({
          categoryId: 1,
          front: 1,
          back: 1,
        })

        return r
          ? {
              categoryId: r.categoryId,
              front: r.front,
              back: r.back,
            }
          : null
      }
    )
  }

  function postGetByIds() {
    const sBody = S.shape({
      ids: S.list(sId).minItems(1),
      select: S.anyOf(S.string(), S.list(S.string())),
    })

    const sResponse = S.shape({
      result: S.list(
        S.shape({
          _id: sId,
          direction: S.string(),
        })
      ),
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
      async (req) => {
        const { ids } = req.body

        const rs = await DbTemplateModel.find({
          _id: { $in: ids },
        }).select({
          _id: 1,
          direction: 1,
        })

        return {
          result: rs.map((r) => ({
            _id: r._id,
            direction: r.direction,
          })),
        }
      }
    )
  }
}
