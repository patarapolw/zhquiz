import S from 'jsonschema-definer'
import Loki, { Collection } from 'lokijs'
import XRegExp from 'xregexp'

const reHan1 = XRegExp('^\\p{Han}$')

export let zh: Loki

const sDistinctString = S.string()
  .minLength(1)
  .custom((s) => new Set(s).size === s.length)

const sDistinctStringArray = S.list(S.string())
  .minItems(1)
  .custom((arr) => new Set(arr).size === arr.length)
  .custom((arr) => (arr as string[]).sort().every((s, i) => s === arr[i]))

const sDictionaryExportShape = {
  entry: S.string(),
  alt: sDistinctStringArray.optional(),
  reading: sDistinctStringArray.optional(),
  translation: sDistinctStringArray,
}

export const sDictionaryExport = S.shape(sDictionaryExportShape).partial()

export const sDictionary = S.shape({
  ...sDictionaryExportShape,
  tag: sDistinctStringArray.optional(),
  frequency: S.number().optional(),
  level: S.integer().maximum(60).minimum(1).optional(),
  priority: S.number().optional(),
  type: S.string().enum('hanzi', 'vocab', 'sentence'),
}).additionalProperties(false)

export let zhDictionary: Collection<typeof sDictionary['type']>

export const sToken = S.shape({
  entry: S.string().custom((s) => reHan1.test(s)),
  sub: sDistinctString.optional(),
  sup: sDistinctString.optional(),
  variants: sDistinctString.optional(),
})

export let zhToken: Collection<typeof sToken['type']>

export async function zhInit(filename = 'assets/zh.loki') {
  return new Promise((resolve) => {
    zh = new Loki(filename, {
      autoload: true,
      autoloadCallback: async () => {
        zhDictionary = zh.getCollection('dictionary')
        if (!zhDictionary) {
          zhDictionary = zh.addCollection('dictionary', {
            unique: [], // [['entry', 'type']]
          })
        }

        zhToken = zh.getCollection('token')
        if (!zhToken) {
          zhToken = zh.addCollection('token', {
            unique: ['entry'],
          })
        }

        resolve()
      },
    })
  })
}
