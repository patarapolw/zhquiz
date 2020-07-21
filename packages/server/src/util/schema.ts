import S, { BaseSchema } from 'jsonschema-definer'

import { srsMap } from '@/db/quiz'

export const sDateTime = S.anyOf(
  S.object().custom((o) => o instanceof Date),
  S.string().format('date-time')
)

/**
 * Project specific
 */
export const sId = S.string()
export const sDictionaryType = S.string().enum('hanzi', 'vocab', 'sentence')
export const sSort = (ks: string[]) =>
  S.string().enum(...ks.flatMap((k) => [k, `-${k}`]))
export const sSrsLevel = S.integer()
  .minimum(0)
  .maximum(srsMap.length - 1)
export const sPerPage = S.integer().minimum(5)
export const sLevel = S.integer().minimum(1).maximum(60)
export const sLang = S.string().enum('chinese')
export const sTranslation = S.string().enum('english')

export function ensureSchema<T extends BaseSchema>(
  schema: T,
  data: T['type']
): T['type'] {
  const [, err] = schema.validate(data)
  if (err) {
    throw new Error((err[0] || {}).message)
  }

  return data as any
}
