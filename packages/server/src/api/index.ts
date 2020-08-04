import fs from 'fs'

import { FastifyInstance } from 'fastify'
import fSession from 'fastify-secure-session'
import admin from 'firebase-admin'

import { DbUserModel } from '@/db/mongo'
import { filterObjValue, ser } from '@/util'
import { parseQuery } from '@/util/query'

import chineseRouter from './chinese'
import dictRouter from './dict'
import extraRouter from './extra'
import quizRouter from './quiz'
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

  f.addHook('preHandler', function (req, _, done) {
    if (req.body && typeof req.body === 'object') {
      req.log.info(
        {
          body: filterObjValue(
            req.body,
            /**
             * This will keep only primitives, nulls, plain objects, Date, and RegExp
             * ArrayBuffer in file uploads will be removed.
             */
            (v) => ser.hash(v) === ser.hash(ser.clone(v))
          ),
        },
        'parsed body'
      )
    }
    done()
  })

  f.addHook<{
    Querystring: Record<string, string | string[]>
  }>('preValidation', async (req) => {
    req.query = parseQuery(req.query)
  })

  f.addHook('preHandler', async (req) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '')

    if (!m) {
      return
    }

    const ticket = await admin.auth().verifyIdToken(m[1], true)
    const user = req.session.get('user')

    if (ticket.email && (!user || user.email !== ticket.email)) {
      req.session.set(
        'user',
        await DbUserModel.signIn(ticket.email, ticket.name)
      )
    }
  })

  f.register(chineseRouter, { prefix: '/chinese' })
  f.register(dictRouter, { prefix: '/dict' })
  f.register(extraRouter, { prefix: '/extra' })
  f.register(userRouter, { prefix: '/user' })
  f.register(quizRouter, { prefix: '/quiz' })

  next()
}
