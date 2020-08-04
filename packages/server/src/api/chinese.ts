import pinyin from 'chinese-to-pinyin'
import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'
import jieba from 'nodejieba'

export default (f: FastifyInstance, _: any, next: () => void) => {
  getJieba()
  getPinyin()

  next()

  function getJieba() {
    const sQuery = S.shape({
      q: S.string(),
    })

    const sResult = S.shape({
      result: S.list(S.string()),
    })

    f.get<{
      Querystring: typeof sQuery.type
    }>(
      '/jieba',
      {
        schema: {
          querystring: sQuery.valueOf(),
          response: {
            200: sResult.valueOf(),
          },
        },
      },
      async (req): Promise<typeof sResult.type> => {
        const { q } = req.query

        return {
          result: jieba.cut(q),
        }
      }
    )
  }

  function getPinyin() {
    const sQuery = S.shape({
      q: S.string(),
    })

    const sResult = S.shape({
      result: S.string(),
    })

    f.get<{
      Querystring: typeof sQuery.type
    }>(
      '/pinyin',
      {
        schema: {
          querystring: sQuery.valueOf(),
          response: {
            200: sResult.valueOf(),
          },
        },
      },
      async (req): Promise<typeof sResult.type> => {
        const { q } = req.query

        return {
          result: pinyin(q, { keepRest: true }),
        }
      }
    )
  }
}
