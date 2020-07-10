import S, { BaseSchema } from 'jsonschema-definer'

import { srsMap } from '@/db/quiz'

export const sStringNonEmpty = S.string().pattern(/[^\s]/)
export const sListStringNonEmpty = S.list(S.string()).minItems(1)
export const sDateTime = S.anyOf(
  S.object().custom((o) => o instanceof Date),
  S.string().format('date-time')
)
export const sStringIntegerNonNegative = S.string().pattern(/^\d+$/)

/**
 * Project specific
 */
export const sId = sStringNonEmpty
export const sDictionaryType = S.string().enum('hanzi', 'vocab', 'sentence')
export const sSort = (ks: string[]) =>
  S.string().enum(...ks.flatMap((k) => [k, `-${k}`]))
export const sSrsLevel = S.integer()
  .minimum(0)
  .maximum(srsMap.length - 1)

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
