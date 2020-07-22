import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { DbUserModel } from '@/db/mongo'
import { checkAuthorize } from '@/util/api'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['user']

  userGetConfig()
  userUpdate()
  userDelete()

  next()

  function userGetConfig() {
    const mySelect =
      process.env.NODE_ENV === 'development'
        ? S.string()
        : S.string().enum(
            'levelMin',
            'level',
            'settings.level.whatToShow',
            'settings.quiz'
          )

    const sQuery = S.shape({
      select: S.list(mySelect).minItems(1),
    })

    f.get<typeof sQuery.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Get user config',
          querystring: sQuery,
        },
      },
      async (req, reply) => {
        if (!checkAuthorize(req, reply)) {
          return
        }

        const { select } = req.query
        const u = req.session.user

        return select.reduce(
          (prev, k) => ({ ...prev, [k]: u[k] }),
          {} as Record<string, any>
        )
      }
    )
  }

  function userUpdate() {
    const sBody = S.shape({
      set:
        process.env.NODE_ENV === 'development'
          ? S.object().additionalProperties(
              S.anyOf(S.string(), S.boolean(), S.list(S.string()))
            )
          : S.shape({
              'settings.level.whatToShow': S.string().optional(),
              'settings.quiz.type': S.list(S.string()).optional(),
              'settings.quiz.stage': S.list(S.string()).optional(),
              'settings.quiz.direction': S.list(S.string()).optional(),
              'settings.quiz.isDue': S.boolean().optional(),
            }),
    })

    f.patch<any, any, any, typeof sBody.type>(
      '/',
      {
        schema: {
          tags,
          summary: 'Update user config',
          body: sBody.valueOf(),
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        const { set } = req.body

        await DbUserModel.findByIdAndUpdate(userId, {
          $set: set,
        })

        reply.status(201).send()
      }
    )
  }

  function userDelete() {
    f.delete(
      '/',
      {
        schema: {
          tags,
          summary: 'Remove current user from database',
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        await DbUserModel.purgeOne(userId)

        reply.status(201).send()
      }
    )
  }
}
