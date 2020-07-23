import pinyin from 'chinese-to-pinyin'
import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'
import jieba from 'nodejieba'

import { sStringNonEmpty } from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['chinese']

  getJieba()
  getPinyin()

  next()

  function getJieba() {
    const sQuery = S.shape({
      q: sStringNonEmpty,
    })

    const sResult = S.shape({
      result: S.list(S.string()),
    })

    f.get<typeof sQuery.type>(
      '/jieba',
      {
        schema: {
          tags,
          summary: 'Cut chinese text into segments',
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
      q: sStringNonEmpty,
    })

    const sResult = S.shape({
      result: S.string(),
    })

    f.get<typeof sQuery.type>(
      '/pinyin',
      {
        schema: {
          tags,
          summary: 'Get pinyin from Chinese test',
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
