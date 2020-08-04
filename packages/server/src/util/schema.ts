import S, { BaseSchema, ObjectSchema } from 'jsonschema-definer'

import { srsMap } from '@/db/quiz'

export const sDateTime = S.anyOf(
  S.object().custom((o) => o instanceof Date) as ObjectSchema<Date>,
  S.string().format('date-time')
)
export const sStringNonEmpty = S.string().pattern(/[^\s]/)
/**
 * https://github.com/ai/nanoid
 */
export const sId = S.string().minLength(21)

/**
 * Project specific
 */
export const sQuizDirection = S.string().enum('se', 'te', 'ec')
export const sDictType = S.string().enum('hanzi', 'vocab', 'sentence')
export const sQuizType = S.anyOf(sDictType, S.string().enum('extra'))
export const sSort = (ks: string[]) =>
  S.string().enum(...ks.flatMap((k) => [k, `-${k}`]))
export const sSrsLevel = S.integer()
  .minimum(0)
  .maximum(srsMap.length - 1)
export const sLevel = S.integer().minimum(1).maximum(60)
export const sQuizStat = S.shape({
  streak: S.shape({
    right: S.integer().minimum(0),
    wrong: S.integer().minimum(0),
    maxRight: S.integer().minimum(0),
    maxWrong: S.integer().minimum(0),
  }),
  lastRight: sDateTime.optional(),
  lastWrong: sDateTime.optional(),
})

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
