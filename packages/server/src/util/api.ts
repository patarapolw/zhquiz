import { FastifyReply, FastifyRequest } from 'fastify'

export function checkAuthorize<T>(
  req: FastifyRequest,
  reply: FastifyReply<any>,
  message?: T
) {
  const u = req.session.user
  if (!u || !u._id) {
    reply.status(401).send(message)
    return null
  }

  return u._id as string
}
