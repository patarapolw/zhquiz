import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { checkAuthorize } from '@/util/api'
import { ensureSchema, sStringNonEmpty } from '@/util/schema'

import { DbUserModel } from '../db/mongo'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['user']

  userGetConfig()
  userUpdate()
  userDelete()

  next()

  function userGetConfig() {
    const sQuery = S.shape({
      select: sStringNonEmpty,
    })

    f.post<typeof sQuery.type>(
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

        return select
          .split(',')
          .reduce(
            (prev, k) => ({ ...prev, [k]: u[k] }),
            {} as Record<string, any>
          )
      }
    )
  }

  function userUpdate() {
    const sBody = S.shape({
      set: S.object(),
    })

    f.patch(
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

        const { set } = ensureSchema(sBody, req.body)

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
