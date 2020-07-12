import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { DbCategoryModel } from '@/db/mongo'
import { sId } from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['category']

  getById()

  next()

  function getById() {
    const sQuery = S.shape({
      id: sId,
      select: S.anyOf(S.string(), S.list(S.string())),
    })

    const sResponse = S.anyOf(
      S.shape({
        type: S.string().optional(),
      }),
      S.null()
    )

    f.get<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Get category by id',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req): Promise<typeof sResponse.type> => {
        const { id } = req.query

        const r = await DbCategoryModel.findById(id).select({
          type: 1,
        })

        return r
          ? {
              type: r.type,
            }
          : null
      }
    )
  }
}
