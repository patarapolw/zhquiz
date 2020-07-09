import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { ensureSchema, sStringNonEmpty } from '@/util/schema'

import { zhToken } from '../db/local'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['token']

  tokenRadical()

  next()

  function tokenRadical() {
    const sQuery = S.shape({
      q: sStringNonEmpty,
    })

    const sResponse = S.shape({
      sub: S.string().optional(),
      sup: S.string().optional(),
      variants: S.string().optional(),
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
        const { q } = ensureSchema(sQuery, req.query)
        const r = zhToken.findOne({ entry: q })

        return {
          sub: r?.sub,
          sup: r?.sup,
          variants: r?.variants,
        }
      }
    )
  }
}
