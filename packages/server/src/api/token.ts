import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'
import XRegExp from 'xregexp'

import { zhToken } from '@/db/local'

export default (f: FastifyInstance, _: any, next: () => void) => {
  getQ()

  next()

  function getQ() {
    const sQuery = S.shape({
      q: S.string(),
      exclude: S.string().optional(),
    })

    const sResponse = S.shape({
      result: S.list(
        S.shape({
          entry: S.string(),
          sub: S.list(S.string()).optional(),
          sup: S.list(S.string()).optional(),
          variants: S.list(S.string()).optional(),
        })
      ),
    })

    f.get<{
      Querystring: typeof sQuery.type
    }>(
      '/q',
      {
        schema: {
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req): Promise<typeof sResponse.type> => {
        const { q, exclude } = req.query
        const qs = (q.match(XRegExp('\\p{Han}')) || []).filter(
          (h, i, arr) => arr.indexOf(h) === i
        )
        const xs = exclude
          ? (exclude.match(XRegExp('\\p{Han}')) || []).filter(
              (h, i, arr) => arr.indexOf(h) === i
            )
          : null

        const rs = zhToken
          .find(
            xs
              ? { $and: [{ entry: { $in: qs } }, { entry: { $nin: xs } }] }
              : { entry: { $in: qs } }
          )
          .reduce(
            (prev, { entry, sub, sup, variants }) => ({
              ...prev,
              [entry]: { sub, sup, variants },
            }),
            {} as any
          )

        return {
          result: qs
            .map((entry) => ({
              entry,
              data: rs[entry],
            }))
            .filter(({ data }) => data)
            .map(({ entry, data }) => ({ entry, ...data })),
        }
      }
    )
  }
}
