import S, { BaseSchema } from 'jsonschema-definer'

import { srsMap } from '../db/quiz'

/**
 * TODO: delete this
 */
export const sAnyObject = S.object()

export const sStringNonEmpty = S.string()
  .minLength(1)
  .custom((s: string) => !!s.trim())
export const sListStringNonEmpty = S.list(S.string()).minItems(1)

/**
 * Project specific
 */
export const sId = sStringNonEmpty
export const sIdJoinedComma = sStringNonEmpty
export const sDictionaryType = S.string().enum('hanzi', 'vocab', 'sentence')
export const sCardType = S.string().enum('hanzi', 'vocab', 'sentence', 'extra')
export const sSort = S.list(
  S.array().items([sStringNonEmpty, S.integer().enum(-1, 1)])
).minItems(1)
export const sSrsLevel = S.integer()
  .minimum(0)
  .maximum(srsMap.length - 1)
export const sStringOneOrPairInteger = S.string().pattern(/^\d+(\.\d+)?$/)
export const sPageFalsable = S.string().pattern(/^(false|\d+(\.\d+)?)$/)

export function ensureSchema<T extends BaseSchema>(
  schema: T,
  data: T['type']
): T['type'] {
  const [, err] = schema.validate(data)
  if (err) {
    throw new Error(err[0]?.message)
  }

  return data as any
}
