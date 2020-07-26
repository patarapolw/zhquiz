import { FastifyInstance } from 'fastify'

import { DbUserModel } from '@/db/mongo'
import { checkAuthorize } from '@/util/api'

export default (f: FastifyInstance, _: any, next: () => void) => {
  getOne()
  doUpdate()
  doDelete()

  next()

  function getOne() {
    f.get('/', async (req, reply) => {
      const u = req.session.get('user')
      if (!u) {
        return reply.status(404).send({
          error: 'Not logged in',
        })
      }

      return u
    })
  }

  function doUpdate() {
    f.patch<{
      Body: {
        set: any
      }
    }>(
      '/',
      {
        schema: {
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
