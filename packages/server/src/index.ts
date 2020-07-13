import path from 'path'

import fastify from 'fastify'
import helmet from 'fastify-helmet'
import fStatic from 'fastify-static'

import { mongoInit } from './util/mongo'
import apiRouter from './api'

async function main() {
  await mongoInit()

  const app = fastify({
    logger:
      process.env.NODE_ENV === 'development'
        ? {
            prettyPrint: true,
          }
        : true,
  })
  const port = parseInt(process.env.PORT || '8080')

  app.register(helmet)
  app.register(apiRouter, { prefix: '/api' })

  app.register(fStatic, {
    root: path.resolve('public'),
  })

  app.setNotFoundHandler((_, reply) => {
    reply.sendFile('index.html')
  })

  app.listen(
    port,
    process.env.NODE_ENV === 'development' ? 'localhost' : '0.0.0.0',
    (err) => {
      if (err) {
        throw err
      }

      console.log(`Go to http://localhost:${port}`)
    }
  )
}

main()
