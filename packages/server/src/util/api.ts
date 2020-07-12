import { FastifyReply, FastifyRequest } from 'fastify'

export function checkAuthorize(
  req: FastifyRequest,
  reply: FastifyReply<any>,
  payload: Record<string, any> & {
    message?: string
  } = {}
) {
  const u = req.session.user
  if (!u || !u._id) {
    payload.message = 'Unauthorized'
    reply.status(401).send(payload)
    return null
  }

  return u._id as string
}
