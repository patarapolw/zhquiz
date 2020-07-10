import makePinyin from 'chinese-to-pinyin'
import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'
import jieba from 'nodejieba'

import { sStringNonEmpty } from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['chinese']

  chineseJieba()
  chinesePinyin()

  next()

  function chineseJieba() {
    const sQuery = S.shape({
      q: sStringNonEmpty,
    })
    const sResponse = S.shape({
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
            200: sResponse.valueOf(),
          },
        },
      },
      async (req): Promise<typeof sResponse.type> => {
        const { q } = req.query

        return {
          result: jieba.cut(q),
        }
      }
    )
  }

  function chinesePinyin() {
    const sQuery = S.shape({
      q: sStringNonEmpty,
    })
    const sResponse = S.shape({
      result: sStringNonEmpty,
    })

    f.get<typeof sQuery.type>(
      '/pinyin',
      {
        schema: {
          tags,
          summary: 'Generate pinyin from Chinese text',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req) => {
        const { q } = req.query

        return {
          result: makePinyin(q, { keepRest: true }),
        }
      }
    )
  }
}
