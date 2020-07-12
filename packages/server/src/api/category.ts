import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import {
  DbCategoryModel,
  sDbCategoryExportPartial,
  sDbCategoryExportSelect,
} from '@/db/mongo'
import { arrayize, reduceToObj } from '@/util'
import { checkAuthorize } from '@/util/api'
import { sId, sMaybeList } from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['category']

  getById()

  next()

  function getById() {
    const sQuery = S.shape({
      id: sId,
      select: sMaybeList(sDbCategoryExportSelect),
    })

    const sResponse = S.shape({
      result: sDbCategoryExportPartial.optional(),
    })

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
      async (req, reply): Promise<typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return undefined as any
        }

        const { id, select } = req.query
        const [result] = await DbCategoryModel.aggregate([
          {
            $match: {
              userId: {
                $in: [userId, 'shared', 'default'],
              },
              _id: id,
            },
          },
          {
            $project: Object.assign(
              { _id: 0 },
              reduceToObj(arrayize(select).map((k) => [k, 1]))
            ),
          },
        ])

        return {
          result,
        }
      }
    )
  }
}
