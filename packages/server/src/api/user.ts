import { FastifyInstance } from 'fastify'

import { DbUserModel } from '@/db/mongo'
import { checkAuthorize } from '@/util/api'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['user']

  getOne()
  doUpdate()
  doDelete()

  next()

  function getOne() {
    f.get(
      '/',
      {
        schema: {
          tags,
          summary: 'Get user config',
        },
      },
      async (req, reply) => {
        const u = req.session.user
        if (!u) {
          return reply.status(404).send({
            error: 'Not logged in',
          })
        }

        return u
      }
    )
  }

  function doUpdate() {
    f.patch(
      '/',
      {
        schema: {
          tags,
          summary: 'Update user config',
          body: {
            type: 'object',
            required: ['set'],
            properties: {
              set: { type: 'object' },
            },
          },
        },
      },
      async (req, reply) => {
        const userId = checkAuthorize(req, reply)
        if (!userId) {
          return
        }

        await DbUserModel.findByIdAndUpdate(userId, {
          $set: req.body.set,
        })
        reply.status(201).send()
      }
    )
  }

  function doDelete() {
    f.delete('/', async (req, reply) => {
      const userId = checkAuthorize(req, reply)
      if (!userId) {
        return
      }

      await DbUserModel.purgeOne(userId)
      reply.status(201).send()
    })
  }
}
