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
        } = req.query

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
      select: mySelectJoinedComma.optional(),
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

        const { q, select = mySelectJoinedCommaDefault } = req.query
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

        const { lang = 'chinese' } = req.query
        const [langFrom, langTo = 'english'] = lang.split(',')

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

  function extraUpdate() {
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
          querystring: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { id } = req.query

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
