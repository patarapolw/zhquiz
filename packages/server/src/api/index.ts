import { FastifyInstance } from 'fastify'
import fCoookie from 'fastify-cookie'
import swagger from 'fastify-oas'
import fSession from 'fastify-session'
import admin from 'firebase-admin'

import { DbUserModel } from '../db/mongo'

import cardRouter from './card'
import extraRouter from './extra'
import hanziRouter from './hanzi'
import libRouter from './lib'
import quizRouter from './quiz'
import sentenceRouter from './sentence'
import userRouter from './user'
import vocabRouter from './vocab'

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

  f.addHook('preHandler', async (req, reply) => {
    if (req.req.url && req.req.url.startsWith('/api/doc')) {
      return
    }

    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '')

    if (!m) {
      reply.status(401).send()
      return
    }

    const ticket = await admin.auth().verifyIdToken(m[1], true)
    // console.log(ticket)

    if (!req.session.user && ticket.email) {
      req.session.user = await DbUserModel.signIn(ticket.email, ticket.name)
    }
  })

  f.register(libRouter, { prefix: '/lib' })
  f.register(sentenceRouter, { prefix: '/sentence' })
  f.register(vocabRouter, { prefix: '/vocab' })
  f.register(hanziRouter, { prefix: '/hanzi' })
  f.register(cardRouter, { prefix: '/card' })
  f.register(userRouter, { prefix: '/user' })
  f.register(quizRouter, { prefix: '/quiz' })
  f.register(extraRouter, { prefix: '/extra' })

  next()
}
