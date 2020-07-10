import escapeRegExp from 'escape-string-regexp'
import S, { BaseSchema } from 'jsonschema-definer'

import { srsMap } from '@/db/quiz'

export const sStringNonEmpty = S.string().minLength(1).pattern(/\S/)
export const sListStringNonEmpty = S.list(S.string()).minItems(1)
export const sDateTime = S.anyOf(
  S.object().custom((o) => o instanceof Date),
  S.string().format('date-time')
)

/**
 * Project specific
 */
export const sId = sStringNonEmpty
export const sIdJoinedComma = sStringNonEmpty
export const sJoinedComma = (ks: string[]) =>
  S.string().pattern(
    new RegExp(`(^|,)(${ks.map((k) => escapeRegExp(k)).join('|')})($|,)`)
  )
export const sSelectDeepJoinedComma = (ks: string[]) =>
  S.string().pattern(
    new RegExp(
      `(^|,)(${ks.map((k) => `${escapeRegExp(k)}(\\.[^,]+)?`).join('|')})($|,)`
    )
  )
export const sDictionaryType = S.string().enum('hanzi', 'vocab', 'sentence')
export const sSort = (ks: string[]) =>
  S.array()
    .items(ks.map((k) => S.array().items([S.enum(k), S.integer().enum(-1, 1)])))
    .minItems(1)
export const sSortJoinedComma = (ks: string[]) =>
  S.string().pattern(
    new RegExp(`(^|,)(${ks.map((k) => `-?${escapeRegExp(k)}`).join('|')})($|,)`)
  )
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
