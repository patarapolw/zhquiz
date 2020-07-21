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
import { checkAuthorize } from '@/util/api'
import { getAuthorizedCategories } from '@/util/mongo'
import { sId } from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['template']

  getById()
  postGetByIds()

  next()

  function getById() {
    const sQuery = S.shape({
      id: sId,
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

        const { id } = req.query

        const cats = await getAuthorizedCategories({
          userId,
        }).select('_id type')

        if (cats.length) {
          const ts = await DbTemplateModel.find({
            _id: id,
            categoryId: { $in: cats.map((c) => c._id) },
          })
            .limit(1)
            .select('-_id categoryId')

          if (ts[0]) {
            const c = cats.find((c) => c._id === ts[0].categoryId)
            return {
              result: {
                type: c?.type,
              },
            }
          }
        }

        return {}
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

        const cats = await getAuthorizedCategories({
          userId,
        }).select('_id type')

        if (cats.length) {
          const result = await DbTemplateModel.find({
            _id: { $in: ids },
            categoryId: { $in: cats.map((c) => c._id) },
          }).select(select.join(' '))

          return {
            result,
          }
        }

        return {
          result: [],
        }
      }
    )
  }
}
