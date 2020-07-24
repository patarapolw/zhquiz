import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { zhDictionary } from '@/db/local'
import { DbQuizModel } from '@/db/mongo'
import { checkAuthorize } from '@/util/api'
import { sDictionaryType, sLevel } from '@/util/schema'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['dictionary']

  getMatch()
  getAlt()
  getRandom()
  getAllLevels()
  getCurrentLevel()

  next()

  function getMatch() {
    const sQuery = S.shape({
      entry: S.string(),
      type: sDictionaryType,
    })

    const sResponse = S.shape({
      entry: S.string(),
      alt: S.list(S.string()).minItems(1).uniqueItems().optional(),
      reading: S.list(S.string()).minItems(1).uniqueItems(),
      english: S.list(S.string()).minItems(1).uniqueItems(),
    })

    f.get<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Get dictionary data for a given entry',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<typeof sResponse.type> => {
        const { entry, type } = req.query
        const r = zhDictionary.findOne({ entry, type })
        if (!r) {
          reply.status(404).send({
            error: 'No match found',
          })
          return undefined as any
        }

        const { alt, reading, english } = r
        return { entry, alt, reading, english }
      }
    )
  }

  function getAlt() {
    const sQuery = S.shape({
      q: S.string(),
      type: S.string().enum('vocab'),
    })

    const sResponse = S.shape({
      entry: S.string(),
      alt: S.list(S.string()).minItems(1).uniqueItems().optional(),
      reading: S.list(S.string()).minItems(1).uniqueItems(),
      english: S.list(S.string()).minItems(1).uniqueItems(),
    })

    f.get<typeof sQuery.type>(
      '/alt',
      {
        schema: {
          tags,
          summary: 'Get dictionary data for a given entry, also alt',
          querystring: sQuery.valueOf(),
          response: {
            200: sResponse.valueOf(),
          },
        },
      },
      async (req, reply): Promise<typeof sResponse.type> => {
        const { q, type } = req.query
        const r =
          zhDictionary.findOne({ entry: q, type }) ||
          zhDictionary.findOne({ alt: { $contains: q }, type })
        if (!r) {
          reply.status(404).send({
            error: 'No match found',
          })
          return undefined as any
        }

        const { entry, alt, reading, english } = r
        return { entry, alt, reading, english }
      }
    )
  }

  function getRandom() {
    const sQuery = S.shape({
      level: sLevel,
      type: sDictionaryType,
      count: S.integer().minimum(1).optional(),
    })

    const sResponse = S.shape({
      result: S.list(
        S.shape({
          entry: S.string(),
          english: S.string(),
          level: sLevel,
        })
      ),
    })

    f.get<typeof sQuery.type>(
      '/random',
      {
        schema: {
          tags,
          summary: 'Randomize dictionary for a given level',
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

        const { level, type, count = 1 } = req.query

        const allMatched = zhDictionary.find({ type, level: { $lte: level } })

        const reviewing = new Set<string>(
          (
            await DbQuizModel.find({
              userId,
              entry: { $in: allMatched.map(({ entry }) => entry) },
              type,
              nextReview: { $exists: true },
            }).select('-_id entry')
          ).map((el) => el.entry)
        )

        const hs = allMatched.filter(({ entry }) => !reviewing.has(entry))
        const result = Array.from({ length: count })
          .map(() => {
            if (hs.length) {
              const i = Math.floor(Math.random() * hs.length)
              return hs.splice(i, 1)[0]
            }
            return null
          })
          .filter((el) => el)
          .map((el) => ({
            entry: el!.entry,
            english: el!.english[0],
            level: el!.level!,
          }))

        return {
          result,
        }
      }
    )
  }

  function getAllLevels() {
    const sQuery = S.shape({
      type: sDictionaryType,
    })

    const sResponse = S.shape({
      result: S.list(
        S.shape({
          entry: S.string(),
          level: S.integer().minimum(1).maximum(60),
          srsLevel: S.integer(),
        })
      ),
    })

    f.get<typeof sQuery.type>(
      '/allLevels',
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

        const { type } = req.query
        const lvMap = zhDictionary
          // @ts-ignore
          .find({ type, level: { $exists: true } })
          .reduce((prev, { entry, level }) => {
            if (level) {
              lvMap.set(entry, level)
            }
            return prev
          }, new Map<string, number>())

        const result = (
          await DbQuizModel.find({
            userId,
            type,
            entry: {
              $in: Array.from(lvMap.keys()),
            },
          }).select('-_id entry srsLevel')
        ).map(({ entry, srsLevel }) => ({
          entry,
          level: lvMap.get(entry)!,
          srsLevel: srsLevel || -1,
        }))

        return {
          result,
        }
      }
    )
  }

  function getCurrentLevel() {
    const sQuery = S.shape({
      type: sDictionaryType,
    })

    const sResponse = S.shape({
      level: S.integer(),
    })

    f.get<typeof sQuery.type>(
      '/currentLevel',
      {
        schema: {
          tags,
          summary: 'Get current level',
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

        const { type } = req.query
        const lvMap = zhDictionary
          // @ts-ignore
          .find({ type, level: { $exists: true } })
          .reduce((prev, { entry, level }) => {
            if (level) {
              lvMap.set(entry, level)
            }
            return prev
          }, new Map<string, number>())

        const itemCount = (
          await DbQuizModel.find({
            userId,
            type,
            entry: {
              $in: Array.from(lvMap.keys()),
            },
          }).select('-_id entry')
        ).reduce((prev, { entry }) => {
          const lv = lvMap.get(entry)!
          const ls = prev.get(lv) || []
          ls.push(entry)
          prev.set(lv, ls)

          return prev
        }, new Map<number, string[]>())

        const level = Math.min(
          1,
          ...Array.from(itemCount)
            .filter(([, its]) => its.length >= 10)
            .map(([lv]) => lv)
        )

        return {
          level,
        }
      }
    )
  }
}
