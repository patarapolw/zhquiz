import { FastifyInstance } from 'fastify'
import fCoookie from 'fastify-cookie'
import swagger from 'fastify-oas'
import fSession from 'fastify-session'
import admin from 'firebase-admin'

import { DbUserModel } from '@/db/mongo'

import categoryRouter from './category'
import chineseRouter from './chinese'
import itemRouter from './item'
import quizRouter from './quiz'
import templateRouter from './template'
import tokenRouter from './token'
import userRouter from './user'

export default (f: FastifyInstance, _: any, next: () => void) => {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SDK!)),
    databaseURL: JSON.parse(process.env.FIREBASE_CONFIG!).databaseURL,
  })

  f.register(swagger, {
    routePrefix: '/doc',
    swagger: {
      consumes: ['application/json'],
      produces: ['application/json'],
      servers: [
        {
          url: 'http://localhost:8080',
          description: 'Local server',
        },
      ],
    },
    exposeRoute: process.env.NODE_ENV === 'development',
  })

  if (process.env.NODE_ENV === 'development') {
    f.register(require('fastify-cors'))
  }

  f.register(fCoookie)
  f.register(fSession, { secret: process.env.SECRET! })

  f.addHook('preHandler', async (req) => {
    if (req.req.url && req.req.url.startsWith('/api/doc')) {
      return
    }

    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '')

    if (!m) {
      return
    }

    const ticket = await admin.auth().verifyIdToken(m[1], true)
    // console.log(ticket)

    if (!req.session.user && ticket.email) {
      req.session.user = await DbUserModel.signIn(ticket.email, ticket.name)
    }
  })

  f.register(chineseRouter, { prefix: '/chinese' })
  f.register(tokenRouter, { prefix: '/token' })
  f.register(itemRouter, { prefix: '/item' })
  f.register(userRouter, { prefix: '/user' })
  f.register(quizRouter, { prefix: '/quiz' })
  f.register(categoryRouter, { prefix: '/category' })
  f.register(templateRouter, { prefix: '/template' })

  next()
}
