import S from 'jsonschema-definer'
import Loki, { Collection } from 'lokijs'
import XRegExp from 'xregexp'

import { sDictionaryType, sLevel } from '@/util/schema'

export let zh: Loki

export const sDictionary = S.shape({
  type: sDictionaryType,
  entry: S.string(),
  alt: S.list(S.string()).minItems(1).uniqueItems().optional(),
  reading: S.list(S.string()).minItems(1).uniqueItems(),
  english: S.list(S.string()).minItems(1).uniqueItems(),
  frequency: S.number().optional(),
  level: sLevel.optional(),
})

export let zhDictionary: Collection<typeof sDictionary.type>

const reHan1 = XRegExp('^\\p{Han}$')
export const sHan1 = S.string().custom((s) => reHan1.test(s))

export const sToken = S.shape({
  entry: sHan1,
  sub: S.list(sHan1).minItems(1).optional(),
  sup: S.list(sHan1).minItems(1).optional(),
  variants: S.list(sHan1).minItems(1).optional(),
})

export let zhToken: Collection<typeof sToken.type>

export async function zhInit(filename = 'assets/zh.loki') {
  return new Promise((resolve) => {
    zh = new Loki(filename, {
      autoload: true,
      autoloadCallback: async () => {
        zhDictionary = zh.getCollection('dictionary')
        if (!zhDictionary) {
          zhDictionary = zh.addCollection('dictionary', {
            indices: ['type', 'entry', 'alt', 'frequency', 'level'],
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
