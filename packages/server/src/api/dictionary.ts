import {
  DefaultHeaders,
  DefaultParams,
  DefaultQuery,
  FastifyInstance,
} from 'fastify'
import S from 'jsonschema-definer'

import {
  DbItemModel,
  DbQuizModel,
  sDbItemExportPartial,
  sDbItemExportSelect,
} from '@/db/mongo'
import { checkAuthorize } from '@/util/api'
import { getAuthorizedCategories } from '@/util/mongo'
import {
  sDictionaryType,
  sLang,
  sLevel,
  sSrsLevel,
  sTranslation,
} from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['dictionary']
  const myShapeDictionaryQuery = {
    type: S.list(sDictionaryType).minItems(1),
    select: S.list(sDbItemExportSelect).minItems(1),
    lang: sLang.optional(),
    translation: sTranslation.optional(),
  }

  getLevel()
  getMatchAlt()
  getMatchExact()
  getSearch()
  postSearch()
  getRandom()

  next()

  function getLevel() {
    const sQuery = S.shape({
      lang: sLang.optional(),
      translation: sTranslation.optional(),
    })

    const sResponse = S.shape({
      result: S.list(
        S.shape({
          entry: S.string().optional(),
          level: S.integer().minimum(1).maximum(60).optional(),
          srsLevel: sSrsLevel.optional(),
        })
      ),
    })

    f.get<typeof sQuery.type>(
      '/level',
      {
        schema: {
          tags,
          summary: 'Get srs levels for every items',
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

        const { lang = 'chinese', translation = 'english' } = req.query

        const result = await getAuthorizedCategories({
          userId,
          lang,
          translation,
        })
          .select('_id')
          .then(async (cs) => {
            if (cs.length) {
              return DbItemModel.find({
                categoryId: { $in: cs.map((r) => r._id) },
                level: { $exists: true },
              })
                .select('entry level')
                .then(async (rs) => {
                  if (rs.length) {
                    const levelMap = rs.reduce((prev, { entry, level = 1 }) => {
                      prev.set(entry, level)
                      return prev
                    }, new Map<string, number>())

                    return DbQuizModel.find({
                      userId,
                      entry: { $in: rs.map((r) => r.entry) },
                    })
                      .select('entry srsLevel')
                      .then((qs) =>
                        qs.map(({ entry, srsLevel }) => ({
                          entry,
                          srsLevel,
                          level: levelMap.get(entry),
                        }))
                      )
                  }

                  return []
                })
            }
            return []
          })

        return {
          result,
        }
      }
    )
  }

  function getMatchAlt() {
    const sQuery = S.shape({
      q: S.string(),
      ...myShapeDictionaryQuery,
    })

    const sResponse = S.shape({
      result: S.list(sDbItemExportPartial),
    })

    f.get<typeof sQuery.type>(
      '/matchAlt',
      {
        schema: {
          tags,
          summary: 'Look up Chinese dictionary for alternate items',
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

        const {
          q,
          type,
          select,
          lang = 'chinese',
          translation = 'english',
        } = req.query

        const result = await getAuthorizedCategories({
          userId,
          type,
          lang,
          translation,
        })
          .select('_id')
          .then((cs) =>
            DbItemModel.find({
              $and: [
                { $or: [{ entry: q }, { alt: q }] },
                { categoryId: { $in: cs.map((c) => c._id) } },
              ],
            }).select(select.join(' '))
          )

        return {
          result,
        }
      }
    )
  }

  function getMatchExact() {
    const sQuery = S.shape({
      q: S.string(),
      ...myShapeDictionaryQuery,
    })

    const sResponse = S.shape({
      result: sDbItemExportPartial.optional(),
    })

    f.get<typeof sQuery.type>(
      '/matchExact',
      {
        schema: {
          tags,
          summary: 'Look up Chinese dictionary for a matched item',
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

        const { q, type, select, lang, translation } = req.query

        const [result] = await getAuthorizedCategories({
          userId,
          type,
          lang,
          translation,
        }).map((cs) =>
          DbItemModel.find({
            entry: q,
            categoryId: { $in: cs.map((c) => c._id) },
          })
            .select(select.join(' '))
            .limit(1)
        )

        return { result }
      }
    )
  }

  function getSearch() {
    const sQuery = S.shape({
      q: S.string(),
      ...myShapeDictionaryQuery,
      page: S.integer().minimum(1).optional(),
      perPage: S.integer().minimum(5).optional(),
      limit: S.integer().minimum(-1),
    })

    const sResponse = S.shape({
      result: S.list(sDbItemExportPartial),
      count: S.integer().minimum(0).optional(),
    })

    f.get<typeof sQuery.type>(
      '/search',
      {
        schema: {
          tags,
          summary: 'Look up Chinese dictionary containing the item',
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

        const {
          q,
          type,
          select,
          page,
          perPage,
          limit,
          lang,
          translation,
        } = req.query

        return _doSearch({
          userId,
          q,
          type,
          select,
          page,
          perPage,
          limit,
          lang,
          translation,
        })
      }
    )
  }

  function postSearch() {
    const sBody = S.shape({
      q: S.string(),
      ...myShapeDictionaryQuery,
      page: S.integer().minimum(1).optional(),
      perPage: S.integer().minimum(5).optional(),
      limit: S.integer().minimum(-1).optional(),
      exclude: S.list(S.string()),
    })

    const sResponse = S.shape({
      result: S.list(sDbItemExportPartial),
      count: S.integer().minimum(0).optional(),
    })

    f.post<DefaultQuery, DefaultParams, DefaultHeaders, typeof sBody.type>(
      '/search',
      {
        schema: {
          tags,
          summary: 'Look up Chinese dictionary containing the item',
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

        const {
          q,
          type,
          select,
          page,
          perPage,
          limit,
          lang,
          translation,
          exclude,
        } = req.body

        return _doSearch({
          userId,
          q,
          type,
          select,
          page,
          perPage,
          limit,
          lang,
          translation,
          exclude,
        })
      }
    )
  }

  function getRandom() {
    const sQuery = S.shape({
      levelMin: sLevel.optional(),
      level: sLevel.optional(),
      ...myShapeDictionaryQuery,
    })

    const sResponse = S.shape({
      result: S.list(sDbItemExportPartial),
      count: S.integer().minimum(0).optional(),
    })

    f.get<typeof sQuery.type>(
      '/random',
      {
        schema: {
          tags,
          summary: 'Get a random Chinese dictionary entry',
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

        const {
          type,
          levelMin = 1,
          level: levelMax = 60,
          lang,
          translation,
          select,
        } = req.query

        return _doSearch({
          userId,
          lang,
          translation,
          type,
          select,
          randomize: {
            levelMin,
            levelMax,
          },
          limit: -1,
        })
      }
    )
  }

  async function _doSearch({
    userId,
    type,
    lang,
    translation,
    q,
    page,
    perPage,
    limit,
    select,
    exclude,
    randomize,
  }: Parameters<typeof getAuthorizedCategories>[0] & {
    q?: string
    page?: number
    perPage?: number
    limit?: number
    select: string[]
    exclude?: string[]
    randomize?: {
      levelMin: number
      levelMax: number
    }
  }) {
    const cs = await (async () => {
      let cursor = getAuthorizedCategories({
        userId,
        type,
        lang,
        translation,
      })
      if (!randomize) {
        cursor = cursor.sort('-priority')
      }

      return cursor.select('_id')
    })()
    if (cs.length) {
      return Promise.all(
        cs.map(async (c) => {
          let itemCusor = DbItemModel.find({
            $and: [
              q ? { $text: { $search: q, $language: lang } } : null,
              { categoryId: c._id },
              { entry: exclude ? { $nin: exclude } : undefined },
            ]
              .filter((el) => el)
              .map((el) => el!),
          })

          if (!randomize) {
            itemCusor = itemCusor.sort('-priority -level')
          }

          return itemCusor.select('_id').then((its) => ({
            itemIds: its.map((it) => it._id),
          }))
        })
      ).then(async (cs1) => {
        const ids = cs1.reduce(
          (prev, { itemIds }) => [...prev, ...itemIds],
          [] as string[]
        )

        let idsInScope: string[] = []

        if (randomize) {
          idsInScope = [ids[Math.floor(Math.random() * ids.length)]]
        } else {
          const idsPerPage = limit === -1 ? null : perPage || limit
          const idsStart = idsPerPage && page ? (page - 1) * idsPerPage : 0
          const idsEnd = idsPerPage && page ? page * idsPerPage : undefined

          idsInScope = ids.slice(idsStart, idsEnd)
        }

        return {
          result: await DbItemModel.find({
            _id: { $in: idsInScope },
          })
            .select(select.join(' '))
            .then((its) => {
              const rMap = its.reduce(
                (prev, it) => ({ ...prev, [it._id]: it }),
                {} as Record<string, any>
              )

              return idsInScope.map((id) => rMap[id])
            }),
          count: page ? ids.length : undefined,
        }
      })
    }
    return {
      result: [],
      count: page ? 0 : undefined,
    }
  }
}
