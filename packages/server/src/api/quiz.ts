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
import { reduceToObj } from '@/util'
import { checkAuthorize } from '@/util/api'
import { safeString } from '@/util/mongo'
import {
  sDateTime,
  sDictionaryType,
  sId,
  sIdJoinedComma,
  sJoinedComma,
  sListStringNonEmpty,
  splitComma,
  sSrsLevel,
  sStringNonEmpty,
} from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['quiz']

  quizGetOne()
  quizGetIds()
  quizGetIdsPost()
  quizRight()
  quizWrong()
  quizRepeat()
  quizUpdateSet()
  quizCreate()
  quizDelete()
  quizInit()
  getAllTags()

  next()

  function quizGetOne() {
    const sQuery = S.shape({
      id: sId,
      select: sJoinedComma([
        '_id',
        'direction',
        'front',
        'back',
        'mnemonic',
      ]).optional(),
    })

    const sResponse = S.shape({
      _id: S.string().optional(),
      direction: S.string().optional(),
      front: S.string().optional(),
      back: S.string().optional(),
      mnemonic: S.string().optional(),
    })

    f.get<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Get info for quiz item',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply) => {
        reply.header('Cache-Control', 'no-cache')

        const { id, select = 'front,back,mnemonic' } = req.query
        const r =
          (await DbQuizModel.findById(id).select(
            Object.assign(
              { _id: 0 },
              reduceToObj((splitComma(select) || []).map((k) => [k, 1]))
            )
          )) || ({} as any)

        return r
      }
    )
  }

  function quizGetIds() {
    const sQuery = S.shape({
      q: sStringNonEmpty,
      type: sDictionaryType.optional(),
      lang: sJoinedComma(['chinese']).optional(),
    })

    const sResponse = S.shape({
      result: S.list(sId),
    })

    f.get<typeof sQuery.type>(
      '/ids',
      {
        schema: {
          tags,
          summary: 'Get quiz ids for a card',
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

        const { q, type, lang } = req.query

        return await _quizGetIds({
          userId,
          entries: [q],
          type,
          lang: splitComma(lang) || ['chinese'],
        })
      }
    )
  }

  function quizGetIdsPost() {
    const sBody = S.shape({
      entries: S.list(S.string()).minItems(1),
      type: sDictionaryType.optional(),
      lang: S.list(S.string().enum('chinese')).minItems(1).maxItems(2),
    })

    const sResponse = S.shape({
      result: S.list(sId),
    })

    f.post<DefaultQuery, DefaultParams, DefaultHeaders, typeof sBody.type>(
      '/ids',
      {
        schema: {
          tags,
          summary: 'Get quiz ids for a card',
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

        const { entries, type, lang } = req.body

        return await _quizGetIds({
          userId,
          entries,
          type,
          lang,
        })
      }
    )
  }

  async function _quizGetIds(o: {
    userId: string
    entries: string[]
    lang: string[]
    type?: string
  }) {
    const rs = await DbQuizModel.aggregate([
      {
        $match: {
          userId: o.userId,
          entry: { $in: o.entries.map((el) => safeString(el)) },
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
                type: safeString(o.type),
              },
            },
          ],
          as: 'c',
        },
      },
      { $match: { c: { $size: { $gt: 0 } } } },
      { $group: { _id: 1 } },
    ])

    return {
      result: rs.map((r) => r._id),
    }
  }

  function quizRight() {
    const sQuery = S.shape({
      id: sId,
    })

    f.patch<typeof sQuery.type>(
      '/right',
      {
        schema: {
          tags,
          summary: 'Mark card as right',
          body: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const { id } = req.query

        const quiz = await DbQuizModel.findOne({ _id: id })
        if (!quiz) {
          reply.status(404).send('no matching quizId')
          return
        }

        quiz.markRight()
        await quiz.save()

        reply.status(201).send()
      }
    )
  }

  function quizWrong() {
    const sQuery = S.shape({
      id: sId,
    })

    f.patch<typeof sQuery.type>(
      '/wrong',
      {
        schema: {
          tags,
          summary: 'Mark card as wrong',
          querystring: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const { id } = req.query

        const quiz = await DbQuizModel.findOne({ _id: id })
        if (!quiz) {
          reply.status(404).send('no matching quizId')
          return
        }

        quiz.markWrong()
        await quiz.save()

        reply.status(201).send()
      }
    )
  }

  function quizRepeat() {
    const sQuery = S.shape({
      id: sId,
    })

    f.patch<typeof sQuery.type>(
      '/repeat',
      {
        schema: {
          tags,
          summary: 'Mark card as repeat',
          querystring: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const { id } = req.query

        const quiz = await DbQuizModel.findOne({ _id: id })
        if (!quiz) {
          reply.status(404).send('no matching quizId')
          return
        }

        quiz.markRepeat()
        await quiz.save()

        reply.status(201).send()
      }
    )
  }

  function getAllTags() {
    const sResponse = S.shape({
      result: S.list(S.string()),
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
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
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
          result: ((r[0] || {}).tags || []).sort(),
        }
      }
    )
  }

  function quizInit() {
    const sQuery = S.shape({
      type: sJoinedComma(['hanzi', 'vocab', 'sentence', 'extra']),
      stage: sJoinedComma(['new', 'leech', 'learning']),
      direction: S.string(),
      due: S.string().enum('1'),
      tag: S.string(),
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
      async (req, reply): Promise<undefined | typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const type = splitComma(req.query.type)
        const stage = splitComma(req.query.stage)
        const direction = splitComma(req.query.direction)
        const isDue = !!req.query.due

        const tag = splitComma(req.query.tag)

        if (!type || !stage || !direction) {
          return {
            quiz: [],
          }
        }

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
                  tag: tag ? { $in: tag.map((t) => safeString(t)) } : undefined,
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
                    direction: { $in: direction.map((t) => safeString(t)) },
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
                        t === 'extra' ? { $exists: false } : t
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

  function quizCreate() {
    const sQuery = S.shape({
      entry: sStringNonEmpty,
      type: sDictionaryType.optional(),
      lang: sJoinedComma(['chinese']).optional(),
    })

    f.put<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Create a quiz item',
          querystring: sQuery.valueOf(),
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { entry, type, lang } = req.query
        const [langFrom, langTo = 'english'] = splitComma(lang) || ['chinese']

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

        await DbQuizModel.insertMany([
          templateIds.map((templateId) => ({
            userId,
            entry,
            templateId,
          })),
        ])

        reply.status(201).send()
      }
    )
  }

  function quizUpdateSet() {
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

  function quizDelete() {
    const sQuery = S.shape({
      id: sIdJoinedComma,
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
          _id: { $in: splitComma(id) || [] },
          userId,
        })

        reply.status(201).send()
      }
    )
  }
}
