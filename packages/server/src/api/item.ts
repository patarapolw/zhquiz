import fs from 'fs'

import makePinyin from 'chinese-to-pinyin'
import dotProp from 'dot-prop-immutable'
import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { zhDictionary } from '@/db/local'
import { DbItemModel } from '@/db/mongo'
import { reduceToObj } from '@/util'
import { checkAuthorize } from '@/util/api'
import {
  ensureSchema,
  sCardType,
  sDateTime,
  sIdJoinedComma,
  sJoinedComma,
  sListStringNonEmpty,
  sPageFalsable,
  sSortJoinedComma,
  sStringNonEmpty,
} from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['item']
  const sItem = S.shape({
    entry: S.string(),
    alt: sListStringNonEmpty.optional(),
    reading: sListStringNonEmpty.optional(),
    translation: sListStringNonEmpty.optional(),
    updatedAt: sDateTime,
  })
  const mySelectJoinedComma = sJoinedComma([
    'entry',
    'alt',
    'reading',
    'translation',
    'updatedAt',
  ])
  const mySelectJoinedCommaDefault = 'entry,alt,reading,translation,updatedAt'
  const mySortJoinedComma = sSortJoinedComma([
    'entry',
    'alt.0',
    'reading.0',
    'translation.0',
    'updatedAt',
  ])

  const template = JSON.parse(
    fs.readFileSync('assets/mongo/template.json', 'utf8')
  ) as {
    templateId: string
    categoryId: string
    type: string
    direction: string
  }[]

  extraAll()
  extraMatch()
  extraCreate()
  extraUpdate()
  extraDelete()

  next()

  function extraAll() {
    const sQuery = S.shape({
      select: mySelectJoinedComma.optional(),
      page: sPageFalsable.optional(),
      sort: mySortJoinedComma.optional(),
    })

    const sResponse = S.shape({
      result: S.list(sItem.partial()),
      count: S.integer().optional(),
    })

    f.post<typeof sQuery.type>(
      '/all',
      {
        schema: {
          tags,
          summary: 'All user-created items',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<undefined | typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const {
          page: pagination = '',
          select = mySelectJoinedCommaDefault,
          sort = '-updatedAt',
        } = ensureSchema(sQuery, req.query)

        let hasCount = false
        let page = 1
        let perPage = 10

        if (pagination !== 'false') {
          hasCount = true
          const p = pagination.split(',').map((p) => parseInt(p))
          page = p[0] || page
          perPage = p[1] || perPage
        }

        const r = await DbItemModel.aggregate([
          ...getExtraChineseAggregate(userId),
          {
            $facet: {
              result: [
                {
                  $sort: sort.split(',').reduce((prev, k) => {
                    if (k.startsWith('-')) {
                      prev[k.substr(1)] = -1
                    } else {
                      prev[k] = 1
                    }

                    return prev
                  }, {} as Record<string, -1 | 1>),
                },
                { $skip: (page - 1) * perPage },
                { $limit: perPage },
                {
                  $project: Object.assign(
                    { _id: 0 },
                    reduceToObj(select.split(',').map((k) => [k, 1]))
                  ),
                },
              ],
              count: hasCount ? [{ $count: 'count' }] : undefined,
            },
          },
        ])

        return {
          result: r[0]?.result || [],
          count: hasCount
            ? dotProp.get(r[0] || {}, 'count.0.count', 0)
            : undefined,
        }
      }
    )
  }

  function extraMatch() {
    const sQuery = S.shape({
      q: sStringNonEmpty,
      select: mySortJoinedComma.optional(),
    })

    const sResponse = sItem.partial()

    f.post<typeof sQuery.type>(
      '/match',
      {
        schema: {
          tags,
          summary: 'Get data for a given user-created item',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { q, select = mySelectJoinedCommaDefault } = ensureSchema(
          sQuery,
          req.query
        )
        const r =
          (
            await DbItemModel.aggregate([
              { $match: { entry: q } },
              ...getExtraChineseAggregate(userId),
              { $limit: 1 },
            ])
          )[0] || ({} as any)

        return select
          .split(',')
          .reduce(
            (prev, k) => ({ ...prev, [k]: r[k] }),
            {} as Record<string, any>
          )
      }
    )
  }

  function extraCreate() {
    const sQuery = S.shape({
      lang: S.string().optional(),
    })

    const sBody = sItem

    const sResponse = S.shape({
      type: sCardType,
    })

    f.put<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Create a user-created item',
          body: sBody.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<undefined | typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { lang } = req.query

        const { entry, reading, translation = [] } = ensureSchema(
          sBody,
          req.body
        )

        const existingTypes = zhDictionary
          .find({
            $or: [{ entry }, { alt: { $containsString: entry } }],
          })
          .reduce(
            (prev, { type }) => ({ ...prev, [type]: (prev[type] || 0) + 1 }),
            {} as Record<string, number>
          )

        if (existingTypes.vocab) {
          return {
            type: 'vocab',
          }
        }

        if (existingTypes.sentence) {
          return {
            type: 'sentence',
          }
        }

        if (existingTypes.hanzi) {
          return {
            type: 'hanzi',
          }
        }

        await DbItemModel.create({
          categoryId: template.filter((t) => t.type === 'extra')[0].categoryId,
          entry,
          reading:
            reading && reading[0]
              ? reading
              : lang === 'chinese'
              ? [makePinyin(entry, { keepRest: true })]
              : undefined,
          translation,
        })

        return {
          type: 'extra',
        }
      }
    )
  }

  function extraUpdate() {
    const sQuery = S.shape({
      id: sIdJoinedComma,
    })

    const sBody = S.shape({
      set: sItem.partial(),
    })

    f.patch<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Update user-created items',
          body: sBody.partial(),
        },
      },
      async (req, reply) => {
        const { id } = ensureSchema(sQuery, req.query)
        const { set } = ensureSchema(sBody, req.body)

        await DbItemModel.updateMany(
          { _id: { $in: id.split(',') } },
          {
            $set: set,
          }
        )

        reply.status(201).send()
      }
    )
  }

  function extraDelete() {
    const sQuery = S.shape({
      id: sIdJoinedComma,
    })

    f.delete<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Delete user-created items',
          querystring: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string', minLength: 1 },
            },
          },
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { id } = ensureSchema(sQuery, req.query)

        await DbItemModel.deleteMany({ _id: { $in: id.split(',') } })
        reply.status(201).send()
      }
    )
  }

  function getExtraChineseAggregate(userId: string) {
    return [
      {
        $lookup: {
          from: 'template',
          let: {
            templateId: '$_id',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$templateId'] },
                    {
                      userId,
                      language: 'chinese',
                      type: { $exists: false },
                    },
                  ],
                },
              },
            },
          ],
          as: 't',
        },
      },
      {
        $match: { t: { $size: { $gt: 0 } } },
      },
    ]
  }
}
