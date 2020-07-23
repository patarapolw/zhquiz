import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { zhToken } from '@/db/local'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['token']

  getMatch()

  next()

  function getMatch() {
    const sQuery = S.shape({
      entry: S.string(),
    })

    const sResponse = S.shape({
      sub: S.string().optional(),
      sup: S.string().optional(),
      variants: S.string().optional(),
    })

    f.get<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Get data for a given Hanzi',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<typeof sResponse.type> => {
        const { entry } = req.body
        const r = zhToken.findOne({ entry })
        if (!r) {
          reply.status(404).send({
            error: 'No match found',
          })
          return undefined as any
        }

        const { sub, sup, variants } = r
        return { sub, sup, variants }
      }
    )
  }
}
