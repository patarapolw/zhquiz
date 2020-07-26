import fs from 'fs'

import { FastifyInstance } from 'fastify'
import fSession from 'fastify-secure-session'
import admin from 'firebase-admin'
import rison from 'rison-node'

import { DbUserModel } from '@/db/mongo'

import chineseRouter from './chinese'
import dictionaryRouter from './dictionary'
import extraRouter from './extra'
import quizRouter from './quiz'
import tokenRouter from './token'
import userRouter from './user'

export default (f: FastifyInstance, _: any, next: () => void) => {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SDK!)),
    databaseURL: JSON.parse(process.env.FIREBASE_CONFIG!).databaseURL,
  })

  if (process.env.NODE_ENV === 'development') {
    f.register(require('fastify-cors'))
  }

  f.register(fSession, { key: fs.readFileSync('session-key') })

  f.addHook('preHandler', async (req, reply) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '')

    if (!m) {
      reply.status(401).send()
      return
    }

    const ticket = await admin.auth().verifyIdToken(m[1], true)
    const user = req.session.get('user')

    if (!user && ticket.email) {
      req.session.set(
        'user',
        await DbUserModel.signIn(ticket.email, ticket.name)
      )
    }
  })

  f.addHook<{
    Querystring: Record<string, string | string[]>
  }>('preValidation', (req) => {
    if (req.query) {
      Object.entries(req.query).map(([k, v]) => {
        if (
          [
            'select',
            'sort',
            'type',
            'direction',
            'tag',
            'offset',
            'limit',
            'page',
            'perPage',
            'count',
          ].includes(k) ||
          /^is[A-Z]/.test(k)
        ) {
          req.query[k] = rison.decode(v)
        }
      })
    }
  })

  f.register(chineseRouter, { prefix: '/chinese' })
  f.register(dictionaryRouter, { prefix: '/dictionary' })
  f.register(quizRouter, { prefix: '/quiz' })
  f.register(extraRouter, { prefix: '/extra' })
  f.register(tokenRouter, { prefix: '/token' })
  f.register(userRouter, { prefix: '/user' })

  next()
}
