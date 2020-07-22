import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import {
  DbCategoryModel,
  DbItemModel,
  DbQuizModel,
  DbTemplateModel,
  DbUserModel,
  sDbQuizExportPartial,
  sDbQuizExportSelect,
  sQuizStat,
} from '@/db/mongo'
import { checkAuthorize } from '@/util/api'
import { sDateTime, sDictionaryType, sId, sSrsLevel } from '@/util/schema'

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
      id: sId,
      select: S.list(sDbQuizExportSelect).minItems(1),
    })

    const sResponse = sDbQuizExportPartial

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
        }).select(`-_id ${select.join(' ')}`)

        return r
      }
    )
  }

  function postGetByIds() {
    const sBody = S.shape({
      ids: S.list(sId),
      select: S.list(sDbQuizExportSelect),
    })

    const sResponse = S.shape({
      result: S.list(sDbQuizExportPartial),
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
        }).select(`-_id ${select.join(' ')}`)

        return { result }
      }
    )
  }

  function getByEntry() {
    const sQuery = S.shape({
      entry: S.string(),
      select: S.list(sDbQuizExportSelect).minItems(1),
      type: S.anyOf(sDictionaryType, S.string().enum('user')),
      limit: S.integer().minimum(-1).optional(),
    })

    const sResponse = S.shape({
      result: S.list(sDbQuizExportPartial),
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

        return {
          result: await _quizGetByEntries({
            entries: [entry],
            select,
            type,
            userId,
          }),
        }
      }
    )
  }

  function postGetByEntries() {
    const sBody = S.shape({
      entries: S.list(S.string()).minItems(1),
      select: S.list(sDbQuizExportSelect),
      type: S.anyOf(sDictionaryType, S.string().enum('user')),
    })

    const sResponse = S.shape({
      result: S.list(sDbQuizExportPartial),
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

        return {
          result: await _quizGetByEntries({
            userId,
            entries,
            select,
            type,
          }),
        }
      }
    )
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

          rs.map((q) => {
            if (!q.nextReview || q.nextReview < now) {
              quiz.push(q)
            } else {
              upcoming.push(q.nextReview.toISOString())
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
      entries: S.list(S.string()),
      type: sDictionaryType.optional(),
    })

    f.put<any, any, any, typeof sBody.type>(
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

        const { entries, type = 'user' } = req.body

        const cats = await DbCategoryModel.find({
          userId,
          type: type === 'user' ? { $exists: false } : type,
        }).select('_id')

        if (!cats.length) {
          reply.status(500).send({
            error: 'Cannot create quiz',
          })
        }

        const ets = (
          await DbCategoryModel.find({
            userId,
            type: type === 'user' ? { $exists: false } : type,
          })
            .select('_id')
            .then((cats) => {
              if (cats.length) {
                return DbTemplateModel.find({
                  categoryId: { $in: cats.map((c) => c._id) },
                })
                  .select('_id categoryId requiredFields')
                  .then((ts) => {
                    return Promise.all(
                      ts.map(async (t) => {
                        if (t.requiredFields && t.requiredFields.length) {
                          return DbItemModel.find({
                            categoryId: t.categoryId,
                            entry: { $in: entries },
                            alt: t.requiredFields.includes('alt')
                              ? { $exists: true }
                              : undefined,
                            reading: t.requiredFields.includes('reading')
                              ? { $exists: true }
                              : undefined,
                            translation: t.requiredFields.includes(
                              'translation'
                            )
                              ? { $exists: true }
                              : undefined,
                          })
                            .select('-_id entry')
                            .then((its) =>
                              its.map(({ entry }) => ({
                                entry,
                                template: t,
                              }))
                            )
                        }

                        return entries.map((entry) => ({
                          entry,
                          template: t,
                        }))
                      })
                    )
                  })
              }

              return []
            })
        ).flatMap((ts) => ts)

        await DbQuizModel.insertMany(
          ets.map(({ entry, template }) => ({
            userId,
            entry,
            templateId: template._id,
          }))
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

        await DbQuizModel.findByIdAndUpdate(id, {
          $set,
          $unset,
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

  async function _quizGetByEntries({
    entries,
    userId,
    type,
    select,
  }: {
    entries: string[]
    userId: string
    type: 'hanzi' | 'vocab' | 'sentence' | 'user'
    select: string[]
  }) {
    const qs = await DbQuizModel.find({
      entry: { $in: entries },
      userId,
    }).select('_id templateId')

    if (qs.length) {
      const result = await DbTemplateModel.find({
        _id: { $in: qs.map((q) => q.templateId) },
      })
        .select('categoryId')
        .then(async (ts) => {
          if (ts.length) {
            const [cat] = await DbCategoryModel.find({
              _id: { $in: ts.map((t) => t.categoryId) },
              type: type === 'user' ? { $exists: false } : type,
            })
              .limit(1)
              .select('_id')

            return await Promise.all(
              ts
                .filter((t) => t.categoryId === cat._id)
                .map(async (t) => {
                  return DbQuizModel.find({
                    _id: {
                      $in: qs
                        .filter((q) => q.templateId === t._id)
                        .map((q) => q._id),
                    },
                  })
                    .select(select.join(' '))
                    .then((qs) => {
                      return qs.map((q) => ({
                        _id: select.includes('_id') ? q._id : undefined,
                        direction: select.includes('direction')
                          ? t.direction
                          : undefined,
                        front: q.front,
                        back: q.back,
                        mnemonic: q.mnemonic,
                        srsLevel: q.srsLevel,
                        stat: q.stat,
                      }))
                    })
                })
            ).then((qss) =>
              qss
                .flatMap((qs) => qs)
                .filter((el) => el)
                .map((el) => el!)
            )
          }

          return []
        })

      return result
    }

    return []
  }
}
