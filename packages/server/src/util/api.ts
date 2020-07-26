import { FastifyReply, FastifyRequest } from 'fastify'

export function checkAuthorize(req: FastifyRequest, reply: FastifyReply) {
  const u = req.session.get('user')
  if (!u || !u._id) {
    reply.status(401)
    return null
  }

  return u._id as string
}
