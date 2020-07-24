import S, { BaseSchema } from 'jsonschema-definer'

export const sDictionaryType = S.string().enum('hanzi', 'vocab', 'sentence')

export type IDictionaryType = typeof sDictionaryType.type

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
