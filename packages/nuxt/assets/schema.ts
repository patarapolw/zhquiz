import S, { BaseSchema } from 'jsonschema-definer'

export const sDictType = S.string().enum('hanzi', 'vocab', 'sentence')
export type IDictType = typeof sDictType.type

export const sDict = S.shape({
  entry: S.string(),
  alt: S.list(S.string()).minItems(1).uniqueItems().optional(),
  reading: S.list(S.string()).minItems(1).uniqueItems(),
  english: S.list(S.string()).minItems(1).uniqueItems(),
  frequency: S.number().optional(),
  level: S.integer().minimum(1).maximum(60).optional(),
})
export type IDict = typeof sDict.type

export const sQuizType = S.string().enum(
  'char-ce',
  'hanzi-ec',
  'vocab-ec',
  'sentence-ec',
  'extra-ce',
  'extra-ec'
)
export type IQuizType = typeof sQuizType.type

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
