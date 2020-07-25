/* eslint-disable import/no-duplicates */
import { FastifyReply, FastifyRequest } from 'fastify'

export function checkAuthorize(
  req: FastifyRequest,
  reply: FastifyReply,
  payload: Record<string, any> & {
    error?: string
  } = {}
) {
  const u = req.session.get('user')
  if (!u || !u._id) {
    payload.error = 'Unauthorized'
    reply.status(401).send(payload)
    return null
  }

  return u._id as string
}
