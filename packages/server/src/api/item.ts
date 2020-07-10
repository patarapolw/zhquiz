import makePinyin from 'chinese-to-pinyin'
import dotProp from 'dot-prop-immutable'
import { DefaultHeaders, DefaultParams, FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { DbCategoryModel, DbItemModel } from '@/db/mongo'
import { reduceToObj } from '@/util'
import { checkAuthorize } from '@/util/api'
import { safeString } from '@/util/mongo'
import {
  sDateTime,
  sDictionaryType,
  sIdJoinedComma,
  sJoinedComma,
  sListStringNonEmpty,
  sPageFalsable,
  splitComma,
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
    '_id',
    'entry',
    'alt',
    'reading',
    'translation',
  ])
  const mySelectJoinedCommaDefault = '_id,entry,alt,reading,translation'
  const mySortJoinedComma = sSortJoinedComma([
    'entry',
    'alt.0',
    'reading.0',
    'translation.0',
    'updatedAt',
  ])

  getAll()
  getMatch()
  doCreate()
  doUpdate()
  doDelete()

  next()

  function getAll() {
    const sQuery = S.shape({
      select: mySelectJoinedComma.optional(),
      page: sPageFalsable.optional(),
      sort: mySortJoinedComma.optional(),
    })

    const sResponse = S.shape({
      result: S.list(sItem.partial()),
      count: S.integer().optional(),
    })

    f.get<typeof sQuery.type>(
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
        reply.header('Cache-Control', 'no-cache')

        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const {
          page: pagination = '',
          select = mySelectJoinedCommaDefault,
          sort = '-updatedAt',
        } = req.query

        let page: number | null = null
        let perPage: number | null = 10

        if (pagination !== 'false') {
          const p = (splitComma(pagination) || []).map((p) => parseInt(p))
          page = p[0] || page
          perPage = p[1] || perPage
        } else {
          page = null
          perPage = null
        }

        const r = await DbItemModel.aggregate([
          ...getExtraChineseAggregate(userId),
          {
            $facet: {
              result: [
                {
                  $sort: (splitComma(sort) || []).reduce((prev, k) => {
                    if (k.startsWith('-')) {
                      prev[k.substr(1)] = -1
                    } else {
                      prev[k] = 1
                    }

                    return prev
                  }, {} as Record<string, -1 | 1>),
                },
                ...(page && perPage ? [{ $skip: (page - 1) * perPage }] : []),
                ...(perPage ? [{ $limit: perPage }] : []),
                {
                  $project: Object.assign(
                    { _id: 0 },
                    reduceToObj((splitComma(select) || []).map((k) => [k, 1]))
                  ),
                },
              ],
              count: page ? [{ $count: 'count' }] : undefined,
            },
          },
        ])

        return {
          result: r[0]?.result || [],
          count: page ? dotProp.get(r[0] || {}, 'count.0.count', 0) : undefined,
        }
      }
    )
  }

  function getMatch() {
    const sQuery = S.shape({
      q: sStringNonEmpty,
      select: mySelectJoinedComma.optional(),
    })

    const sResponse = sItem.partial()

    f.get<typeof sQuery.type>(
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
        reply.header('Cache-Control', 'no-cache')

        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { q, select = mySelectJoinedCommaDefault } = req.query
        const r =
          (
            await DbItemModel.aggregate([
              { $match: { entry: q } },
              ...getExtraChineseAggregate(userId),
              { $limit: 1 },
            ])
          )[0] || ({} as any)

        return (splitComma(select) || []).reduce(
          (prev, k) => ({ ...prev, [k]: r[k] }),
          {} as Record<string, any>
        )
      }
    )
  }

  function doCreate() {
    const sQuery = S.shape({
      lang: sJoinedComma(['chinese']).optional(),
    })

    const sBody = sItem

    const sResponse = S.shape({
      type: sDictionaryType.optional(),
    })

    f.put<typeof sQuery.type, DefaultParams, DefaultHeaders, typeof sBody.type>(
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
        const [langFrom, langTo = 'english'] = splitComma(lang) || ['chinese']

        const { entry, reading, translation = [] } = req.body

        const existing = await DbItemModel.aggregate([
          {
            $match: {
              $or: [{ entry }, { alt: entry }],
            },
          },
          {
            $lookup: {
              from: 'category',
              let: {
                categoryId: '$categoryId',
              },
              pipeline: [
                {
                  $match: {
                    userId: {
                      $in: [userId, 'shared', 'default'],
                    },
                    langFrom: safeString(langFrom),
                    langTo: safeString(langTo),
                  },
                },
                { $match: { $expr: { $eq: ['$_id', '$$categoryId'] } } },
              ],
              as: 'c',
            },
          },
          { $unwind: '$c' },
          { $unwind: { path: '$c.type', preserveNullAndEmptyArrays: true } },
          {
            group: {
              _id: 'entry',
              type: { $push: '$c.type' },
            },
          },
          { $limit: 1 },
        ])

        if (existing[0]) {
          return {
            type: dotProp.get(existing[0], 'type.0'),
          }
        }

        const template = await DbCategoryModel.aggregate([
          {
            $match: {
              userId: {
                $in: [userId, 'shared', 'default'],
              },
              type: { $exists: false },
              langFrom: safeString(langFrom),
              langTo: safeString(langTo),
            },
          },
          {
            $sort: {
              priority: -1,
            },
          },
          { $limit: 1 },
          {
            $lookup: {
              from: 'template',
              localField: '_id',
              foreignField: 'categoryId',
              as: 't',
            },
          },
          { $unwind: '$t' },
          {
            $project: {
              _id: 0,
              categoryId: '$_id',
              templateId: '$t._id',
            },
          },
        ])

        if (!template.length) {
          reply
            .status(500)
            .send(
              'Cannot create item due to lack of templating for quiz. Please contact the admin.'
            )
          return
        }

        await DbItemModel.create({
          categoryId: template[0].categoryId,
          entry,
          reading:
            reading && reading[0]
              ? reading
              : langFrom === 'chinese'
              ? [makePinyin(entry, { keepRest: true })]
              : undefined,
          translation,
        })

        return {}
      }
    )
  }

  function doUpdate() {
    const sQuery = S.shape({
      id: sIdJoinedComma,
    })

    const sBody = S.shape({
      set: sItem.partial(),
    })

    f.patch<
      typeof sQuery.type,
      DefaultParams,
      DefaultHeaders,
      typeof sBody.type
    >(
      '/',
      {
        schema: {
          tags,
          summary: 'Update user-created items',
          body: sBody.partial(),
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { id } = req.query
        const { set } = req.body

        await DbItemModel.updateMany(
          { _id: { $in: splitComma(id) || [] } },
          {
            $set: set,
          }
        )

        reply.status(201).send()
      }
    )
  }

  function doDelete() {
    const sQuery = S.shape({
      id: sIdJoinedComma,
    })

    f.delete<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Delete user-created items',
          querystring: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { id } = req.query

        await DbItemModel.deleteMany({ _id: { $in: splitComma(id) || [] } })
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
                      langFrom: 'chinese',
                      langTo: 'english',
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
