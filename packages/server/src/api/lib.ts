import pinyin from 'chinese-to-pinyin'
import { FastifyInstance } from 'fastify'
import jieba from 'nodejieba'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['lib']

  f.post(
    '/jieba',
    {
      schema: {
        tags,
        summary: 'Cut chinese text into segments',
        body: {
          type: 'object',
          required: ['q'],
          properties: {
            q: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              result: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    async (req) => {
      const { q } = req.body

      return {
        result: jieba.cut(q),
      }
    }
  )

  f.post(
    '/pinyin',
    {
      schema: {
        tags,
        summary: 'Generate pinyin from Chinese text',
        body: {
          type: 'object',
          required: ['q'],
          properties: {
            q: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              result: { type: 'string' },
            },
          },
        },
      },
    },
    async (req) => {
      const { q } = req.body

      return {
        result: pinyin(q, { keepRest: true }),
      }
    }
  )

  next()
}
