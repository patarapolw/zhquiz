import { FastifyInstance } from 'fastify'

import { DbUserModel } from '../db/mongo'

export default (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['user']

  f.post(
    '/',
    {
      schema: {
        tags,
        summary: 'Get user config',
        body: {
          type: 'object',
          required: ['select'],
          properties: {
            select: { type: 'array', items: { type: 'string' }, minItems: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      const u = req.session.user
      if (!u) {
        reply.status(401).send()
        return
      }

      const { select } = req.body
      return (select as string[]).reduce(
        (prev, k) => ({ ...prev, [k]: u[k] }),
        {} as Record<string, any>
      )
    }
  )

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
      const u = req.session.user
      if (u) {
        await DbUserModel.findByIdAndUpdate(u._id, {
          $set: req.body.set,
        })

        return reply.status(201).send()
      }

      return reply.status(400).send()
    }
  )

  f.delete(
    '/',
    {
      schema: {
        tags,
        summary: 'Remove current user from database',
      },
    },
    async (req, reply) => {
      const u = req.session.user
      if (u) {
        await DbUserModel.purgeOne(u._id)

        return reply.status(201).send()
      }

      return reply.status(400).send()
    }
  )

  next()
}
