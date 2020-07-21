import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { sDbCategoryExportPartial, sDbCategoryExportSelect } from '@/db/mongo'
import { checkAuthorize } from '@/util/api'
import { getAuthorizedCategories } from '@/util/mongo'
import { sId } from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['category']

  getById()

  next()

  function getById() {
    const sQuery = S.shape({
      id: sId,
      select: S.list(sDbCategoryExportSelect).minItems(1),
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
        const [result] = await getAuthorizedCategories({
          categoryId: id,
          userId,
        })
          .select(select.join(' '))
          .limit(1)

        return {
          result,
        }
      }
    )
  }
}
