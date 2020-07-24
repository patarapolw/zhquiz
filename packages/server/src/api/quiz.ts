import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { checkAuthorize } from '@/util/api'
import { sDateTime, sSrsLevel } from '@/util/schema'

import { DbQuizModel, DbUserModel, sDbQuiz, sQuizStat } from '../db/mongo'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['quiz']

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
      id: S.string(),
      select: S.list(S.string()).minItems(1),
    })

    const sResponse = sDbQuiz

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
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { id, select } = req.query
        const r = await DbQuizModel.findOne({
          _id: id,
          userId,
        }).select(select.join(' '))

        return r
      }
    )
  }

  function postGetByIds() {
    const sBody = S.shape({
      ids: S.list(S.string()),
      select: S.list(S.string()),
    })

    const sResponse = S.shape({
      result: S.list(sDbQuiz),
    })

    f.post<any, any, any, typeof sBody.type>(
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
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { ids, select } = req.body
        const result = await DbQuizModel.find({
          _id: { $in: ids },
          userId,
        }).select(select.join(' '))

        return { result }
      }
    )
  }

  function getByEntry() {
    const sQuery = S.shape({
      entry: S.string(),
      select: S.list(S.string()).minItems(1),
      type: S.string(),
    })

    const sResponse = S.shape({
      result: S.list(sDbQuiz),
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
      async (req, reply): Promise<typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return undefined as any
        }

        const { entry, select, type } = req.query

        const result = (await DbQuizModel.find({
          entry,
          type,
          userId,
        }).select(select.join(' '))) as any

        return {
          result,
        }
      }
    )
  }

  function postGetByEntries() {
    const sBody = S.shape({
      entries: S.list(S.string()).minItems(1),
      select: S.list(sDbQuiz),
      type: S.string(),
    })

    const sResponse = S.shape({
      result: S.list(sDbQuiz),
    })

    f.post<any, any, any, typeof sBody.type>(
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
      async (req, reply): Promise<typeof sResponse.type> => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return undefined as any
        }

        const { entries, select, type } = req.body

        const result = (await DbQuizModel.find({
          entry: { $in: entries },
          type,
          userId,
        }).select(select.join(' '))) as any

        return {
          result,
        }
      }
    )
  }

  function doMark() {
    const sQuery = S.shape({
      id: S.string(),
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
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return undefined as any
        }

        const { id, type } = req.query

        const quiz = await DbQuizModel.findOne({
          userId,
          _id: id,
        })
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
      type: S.list(myType),
      stage: S.list(myStage),
      direction: S.list(S.string()),
      isDue: S.boolean().optional(),
      tag: S.list(S.string()).optional(),
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

        const { type, stage, direction, isDue: _isDue, tag } = req.query
        const isDue = !!_isDue

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

        const rs = await DbQuizModel.find({
          $and: [
            {
              userId,
              tag: tag ? { $in: tag } : undefined,
            },
            ...($or.length ? [{ $or }] : []),
          ],
        }).select('_id nextReview srsLevel stat')

        if (isDue) {
          const now = new Date()
          const quiz: typeof sQuizItem.type[] = []
          const upcoming: string[] = []

          rs.map(({ nextReview, srsLevel, stat, _id }) => {
            if (!nextReview || nextReview < now) {
              quiz.push({ nextReview, srsLevel, stat, _id })
            } else {
              upcoming.push(nextReview.toISOString())
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
      entry: S.anyOf(S.string(), S.list(S.string())),
      type: S.list(S.string()),
    })

    f.put<any, any, any, typeof sBody.type>(
      '/',
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

        const { entry, type: types } = req.body
        const entries = Array.isArray(entry) ? entry : [entry]

        try {
          await DbQuizModel.insertMany(
            entries.flatMap((entry) =>
              types.map((type) => ({
                userId,
                entry,
                type,
              }))
            ),
            { ordered: false }
          )
        } catch (e) {
          if (e.nInserted === 0) {
            reply.status(304).send({
              error: 'No quiz items created',
            })
            return
          }

          const writeCount = new Map<string, number>()

          ;(e.writeErrors || []).map(({ op: { entry } }: any) => {
            writeCount.set(entry, (writeCount.get(entry) || 0) + 1)
          })

          const failedEntries = Array.from(writeCount)
            .filter(([, count]) => count >= types.length)
            .map(([k]) => k)

          if (failedEntries.length) {
            reply.status(304).send({
              error: `The following quiz items failed to create: ${failedEntries.join(
                ','
              )}`,
            })
            return
          }
        }

        reply.status(201).send()
      }
    )
  }

  function doUpdateSet() {
    const sQuery = S.shape({
      id: S.string(),
    })

    const sBody = S.shape({
      set: S.shape({
        front: S.string().optional(),
        back: S.string().optional(),
        mnemonic: S.string().optional(),
        tag: S.list(S.string()).optional(),
      }),
    })

    f.patch<typeof sQuery.type, any, any, typeof sBody.type>(
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
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { id } = req.query
        const { set } = req.body

        const $set: any = {}
        const $unset: any = {}

        Object.entries(set).map(([k, v]) => {
          if (v === '') {
            $unset[k] = ''
          } else if (Array.isArray(v) && v.length === 0) {
            $unset[k] = ''
          } else {
            $set[k] = v
          }
        })

        await DbQuizModel.findOneAndUpdate(
          {
            userId,
            _id: id,
          },
          {
            $set,
            $unset,
          }
        )

        reply.status(201).send()
      }
    )
  }

  function doDelete() {
    const sQuery = S.shape({
      id: S.string(),
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
        await DbQuizModel.deleteOne({
          _id: id,
          userId,
        })

        reply.status(201).send()
      }
    )
  }

  function postDeleteByIds() {
    const sBody = S.shape({
      ids: S.list(S.string()).minItems(1),
    })

    f.post<any, any, any, typeof sBody.type>(
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
