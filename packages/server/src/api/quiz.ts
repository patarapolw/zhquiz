import {
  DefaultHeaders,
  DefaultParams,
  DefaultQuery,
  FastifyInstance,
} from 'fastify'
import S from 'jsonschema-definer'

import {
  DbCategoryModel,
  DbQuizModel,
  DbUserModel,
  sQuizStat,
} from '@/db/mongo'
import { arrayize, reduceToObj } from '@/util'
import { checkAuthorize } from '@/util/api'
import { safeString } from '@/util/mongo'
import {
  sDateTime,
  sDictionaryType,
  sId,
  sListStringNonEmpty,
  sSrsLevel,
  sStringNonEmpty,
} from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['quiz']
  const mySelect = S.string().enum(
    '_id',
    'direction',
    'front',
    'back',
    'mnemonic',
    'srsLevel'
  )
  const myQuizItemPartial = S.shape({
    _id: S.string().optional(),
    direction: S.string().optional(),
    front: S.string().optional(),
    back: S.string().optional(),
    mnemonic: S.string().optional(),
    srsLevel: S.integer().optional(),
  })

  getById()
  postGetByIds()
  getByEntry()
  postGetByEntries()
  doMark()
  getTagAll()
  getInit()
  doCreateByEntry()
  doUpdateSet()
  doDelete()
  postDeleteByIds()

  next()

  function getById() {
    const sQuery = S.shape({
      id: sId,
      select: S.anyOf(mySelect, S.list(mySelect)).optional(),
    })

    const sResponse = myQuizItemPartial

    f.get<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Get info for a quiz item',
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

        const { id, select = ['front', 'back', 'mnemonic'] } = req.query
        const r =
          (await DbQuizModel.findOne({
            _id: id,
            userId,
          }).select(
            Object.assign(
              { _id: 0 },
              reduceToObj(arrayize(select).map((k) => [k, 1]))
            )
          )) || ({} as any)

        return r
      }
    )
  }

  function postGetByIds() {
    const sBody = S.shape({
      ids: S.list(sId),
      select: S.list(mySelect),
    })

    const sResponse = S.shape({
      result: S.list(myQuizItemPartial),
    })

    f.post<DefaultQuery, DefaultParams, DefaultHeaders, typeof sBody.type>(
      '/ids',
      {
        schema: {
          tags,
          summary: 'Get info for a quiz item',
          body: sBody.valueOf(),
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

        const { ids, select } = req.body
        const result = await DbQuizModel.aggregate([
          {
            $match: {
              _id: { $in: ids },
              userId,
            },
          },
          {
            $project: Object.assign(
              { _id: 0 },
              reduceToObj(arrayize(select).map((k) => [k, 1]))
            ),
          },
        ])

        return { result }
      }
    )
  }

  function getByEntry() {
    const sQuery = S.shape({
      entry: sStringNonEmpty,
      select: S.anyOf(mySelect, S.list(mySelect)),
      type: S.anyOf(sDictionaryType, S.string().enum('user')),
      lang: S.string().enum('chinese').optional(),
      limit: S.string().enum('-1').optional(),
    })

    const sResponse = S.shape({
      result: S.list(myQuizItemPartial),
    })

    f.get<typeof sQuery.type>(
      '/entry',
      {
        schema: {
          tags,
          summary: 'Get a quiz entry',
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

        const { entry, select, type, lang } = req.query

        return await _quizGet({
          userId,
          entries: [entry],
          type,
          select,
          lang: arrayize(lang),
        })
      }
    )
  }

  function postGetByEntries() {
    const sBody = S.shape({
      entries: S.list(S.string()).minItems(1),
      select: S.list(mySelect),
      type: S.anyOf(sDictionaryType, S.string().enum('user')),
      lang: S.list(S.string().enum('chinese')).minItems(1).maxItems(2),
    })

    const sResponse = S.shape({
      result: S.list(myQuizItemPartial),
    })

    f.post<DefaultQuery, DefaultParams, DefaultHeaders, typeof sBody.type>(
      '/entries',
      {
        schema: {
          tags,
          summary: 'Get quiz entries via POST',
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

        const { entries, select, type, lang } = req.body

        return await _quizGet({
          userId,
          entries,
          select,
          type,
          lang,
        })
      }
    )
  }

  async function _quizGet(o: {
    userId: string
    entries: string[]
    lang: (string | undefined)[]
    type: string
    select: string | string[]
  }) {
    const rs = await DbQuizModel.aggregate([
      {
        $match: {
          userId: o.userId,
          entry: { $in: o.entries.map(safeString) },
        },
      },
      {
        $lookup: {
          from: 'template',
          localField: 'templateId',
          foreignField: '_id',
          as: 't',
        },
      },
      { $unwind: '$t' },
      {
        $lookup: {
          from: 'category',
          let: {
            categoryId: '$t.categoryId',
          },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$categoryId'] } } },
            {
              $match: {
                langFrom: safeString(o.lang[0] || 'chinese'),
                langTo: safeString(o.lang[1] || 'english'),
                type:
                  o.type === 'user' ? { $exists: false } : safeString(o.type),
              },
            },
          ],
          as: 'c',
        },
      },
      { $match: { c: { $size: { $gt: 0 } } } },
      {
        $group: {
          _id: 0,
          ...reduceToObj(
            arrayize(o.select).map((k) => [
              k,
              k === '_id' ? 1 : { $first: `$${k}` },
            ])
          ),
        },
      },
    ])

    return {
      result: rs.map((r) => r._id),
    }
  }

  function doMark() {
    const sQuery = S.shape({
      id: sId,
      type: S.string().enum('right', 'wrong', 'repeat'),
    })

    f.patch<typeof sQuery.type>(
      '/mark',
      {
        schema: {
          tags,
          summary: 'Mark card in a quiz session',
          querystring: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const { id, type } = req.query

        const quiz = await DbQuizModel.findOne({ _id: id })
        if (!quiz) {
          reply.status(404).send('no matching quizId')
          return
        }

        ;({
          right: () => quiz.markRepeat(),
          wrong: () => quiz.markWrong(),
          repeat: () => quiz.markRepeat(),
        }[type]())

        await quiz.save()

        reply.status(201).send()
      }
    )
  }

  function getTagAll() {
    const sResponse = S.shape({
      tags: S.list(S.string()),
    })

    f.get(
      '/tag/all',
      {
        schema: {
          tags,
          summary: 'Get all tag names',
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (
        req,
        reply
      ): Promise<{
        tags: []
      }> => {
        const userId = checkAuthorize(req, reply, {
          tags: [],
        })
        if (!userId) {
          return {
            tags: [],
          }
        }

        const r = await DbQuizModel.aggregate([
          { $match: { userId } },
          {
            $group: {
              _id: null,
              tags: { $addToSet: '$tag' },
            },
          },
        ])

        return {
          tags: ((r[0] || {}).tags || []).sort(),
        }
      }
    )
  }

  function getInit() {
    const myType = S.string().enum('hanzi', 'vocab', 'sentence', 'extra')
    const myStage = S.string().enum('new', 'leech', 'learning', 'graduated')

    const sQuery = S.shape({
      type: S.anyOf(myType, S.list(myType)),
      stage: S.anyOf(myStage, S.list(myStage)),
      direction: S.anyOf(S.string(), S.list(S.string())),
      isDue: S.string().enum('1').optional(),
      tag: S.anyOf(S.string(), S.list(S.string())),
    })

    const sQuizItem = S.shape({
      _id: S.string(),
      srsLevel: sSrsLevel.optional(),
      nextReview: sDateTime.optional(),
      stat: sQuizStat.optional(),
    })

    const sResponse = S.shape({
      quiz: S.list(sQuizItem),
      upcoming: S.list(sDateTime).optional(),
    })

    f.get<typeof sQuery.type>(
      '/init',
      {
        schema: {
          tags,
          summary: 'Get data necessary for initializing a quiz',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply, {
          quiz: [],
        })
        if (!userId) {
          return {
            quiz: [],
          }
        }

        const {
          type: _type,
          stage: _stage,
          direction: _direction,
          isDue: _isDue,
          tag: _tag,
        } = req.query

        const type = arrayize(_type)
        const stage = arrayize(_stage)
        const direction = arrayize(_direction)
        const isDue = !!_isDue
        const tag = arrayize(_tag)

        /**
         * No need to await
         */
        DbUserModel.findByIdAndUpdate(userId, {
          $set: {
            'settings.quiz.type': type,
            'settings.quiz.stage': stage,
            'settings.quiz.direction': direction,
            'settings.quiz.isDue': isDue,
          },
        })

        const $or: any[] = []

        if (stage.includes('new')) {
          $or.push({
            nextReview: { $exists: false },
          })
        }

        if (stage.includes('leech')) {
          $or.push({
            'stat.streak.wrong': { $gte: 3 },
          })
        }

        if (stage.includes('learning')) {
          $or.push({
            srsLevel: { $lt: 3 },
          })
        }

        if (stage.includes('graduated')) {
          $or.push({
            srsLevel: { $gte: 3 },
          })
        }

        const rs = (await DbQuizModel.aggregate([
          {
            $match: {
              $and: [
                {
                  userId,
                  tag: tag ? { $in: tag.map(safeString) } : undefined,
                },
                ...($or.length ? [{ $or }] : []),
              ],
            },
          },
          {
            $lookup: {
              from: 'template',
              let: {
                templateId: '$templateId',
              },
              pipeline: [
                { $match: { $expr: { $eq: ['templateId', '$$templateId'] } } },
                {
                  $match: {
                    direction: { $in: direction.map(safeString) },
                  },
                },
              ],
              as: 't',
            },
          },
          { $unwind: '$t' },
          {
            $lookup: {
              from: 'category',
              let: {
                categoryId: '$t.categoryId',
              },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$$categoryId'] } } },
                {
                  $match: {
                    type: {
                      $in: type.map((t) =>
                        t === 'extra' ? { $exists: false } : safeString(t)
                      ),
                    },
                  },
                },
              ],
              as: 'c',
            },
          },
          { $match: { c: { $size: { $gt: 0 } } } },
          {
            $group: {
              _id: '$_id',
              nextReview: { $toString: { $first: '$nextReview' } },
              srsLevel: { $first: '$srsLevel' },
              stat: { $first: '$stat' },
            },
          },
        ])) as typeof sQuizItem.type[]

        if (isDue) {
          const now = new Date()
          const quiz: typeof sQuizItem.type[] = []
          const upcoming: string[] = []

          rs.map((q) => {
            if (!q.nextReview || q.nextReview < now) {
              quiz.push(q)
            } else {
              upcoming.push(q.nextReview as string)
            }
          })

          return {
            quiz: quiz.sort(() => 0.5 - Math.random()),
            upcoming: upcoming.sort(),
          }
        } else {
          return {
            quiz: rs.sort(() => 0.5 - Math.random()),
          }
        }
      }
    )
  }

  function doCreateByEntry() {
    const sBody = S.shape({
      entries: S.list(sStringNonEmpty),
      type: sDictionaryType.optional(),
      lang: S.string().enum('chinese').optional(),
    })

    f.put<DefaultQuery, DefaultParams, DefaultHeaders, typeof sBody.type>(
      '/entries',
      {
        schema: {
          tags,
          summary: 'Create a quiz item',
          body: sBody.valueOf(),
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { entries, type, lang } = req.body

        let [langFrom, langTo] = arrayize(lang) as string[]
        langFrom = langFrom || 'chinese'
        langTo = langTo || 'english'

        const templateIds = (
          await DbCategoryModel.aggregate([
            {
              $match: {
                userId: { $in: [userId, 'shared', 'default'] },
                type: safeString(type),
                langFrom: safeString(langFrom),
                langTo: safeString(langTo),
              },
            },
            { $sort: { priority: -1 } },
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
                _id: '$t._id',
              },
            },
          ])
        ).map((t) => t._id)

        await DbQuizModel.insertMany(
          entries.flatMap((ent) =>
            templateIds.map((templateId) => ({
              userId,
              entry: ent,
              templateId,
            }))
          )
        )

        reply.status(201).send()
      }
    )
  }

  function doUpdateSet() {
    const sQuery = S.shape({
      id: sId,
    })

    const sBody = S.shape({
      set: S.shape({
        front: S.string().optional(),
        back: S.string().optional(),
        mnemonic: S.string().optional(),
        tag: sListStringNonEmpty.optional(),
      }),
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
          summary: 'Update a quiz item',
          querystring: sQuery.valueOf(),
          body: sBody.valueOf(),
        },
      },
      async (req, reply) => {
        const { id } = req.query
        const { set } = req.body

        await DbQuizModel.findByIdAndUpdate(id, {
          $set: set,
        })

        reply.status(201).send()
      }
    )
  }

  function doDelete() {
    const sQuery = S.shape({
      id: sId,
    })

    f.delete<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Delete a quiz item',
          querystring: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { id } = req.query
        await DbQuizModel.deleteMany({
          _id: id,
          userId,
        })

        reply.status(201).send()
      }
    )
  }

  function postDeleteByIds() {
    const sBody = S.shape({
      ids: S.list(sId).minItems(1),
    })

    f.post<DefaultQuery, DefaultParams, DefaultHeaders, typeof sBody.type>(
      '/delete/ids',
      {
        schema: {
          tags,
          summary: 'Delete multiple quiz items',
          body: sBody.valueOf(),
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { ids } = req.body
        await DbQuizModel.deleteMany({
          _id: { $in: ids },
          userId,
        })

        reply.status(201).send()
      }
    )
  }
}
