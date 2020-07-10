import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { DbTokenModel, sToken, sTokenArray } from '@/db/mongo'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['token']

  tokenRadical()

  next()

  function tokenRadical() {
    const sQuery = S.shape({
      q: sToken,
    })

    const sResponse = S.shape({
      sub: sTokenArray.optional(),
      sup: sTokenArray.optional(),
      variants: sTokenArray.optional(),
    })

    f.get<typeof sQuery.type>(
      '/radical',
      {
        schema: {
          tags,
          summary: 'Look up Chinese characters for related characters',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req) => {
        const { q } = req.query
        const r = await DbTokenModel.findById(q)

        return {
          sub: r?.sub,
          sup: r?.sup,
          variants: r?.variants,
        }
      }
    )
  }
}
