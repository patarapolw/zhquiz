import S from 'jsonschema-definer'
import Loki, { Collection } from 'lokijs'
import XRegExp from 'xregexp'

import { sLevel } from '@/util/schema'

export let zh: Loki

export const sDictType = S.string().enum('hanzi', 'vocab', 'sentence')
export type IDictType = typeof sDictType.type

export const sDict = S.shape({
  entry: S.string(),
  alt: S.list(S.string()).minItems(1).uniqueItems().optional(),
  reading: S.list(S.string()).minItems(1).uniqueItems(),
  english: S.list(S.string()).minItems(1).uniqueItems(),
  frequency: S.number().optional(),
  level: sLevel.optional(),
})

export let zhDict: Record<IDictType, Collection<typeof sDict.type>>

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
        const createDict = (name: string) => {
          let dict = zh.getCollection(name) as Collection<typeof sDict.type>
          if (!dict) {
            dict = zh.addCollection(name, {
              unique: ['entry'],
              indices: ['alt', 'frequency', 'level'],
            })
          }
          return dict
        }

        zhDict = {
          hanzi: createDict('hanzi'),
          vocab: createDict('vocab'),
          sentence: createDict('sentence'),
        }

        zhToken = zh.getCollection('token')
        if (!zhToken) {
          zhToken = zh.addCollection('token', {
            unique: ['entry'],
            indices: ['variants'],
          })
        }

        resolve()
      },
    })
  })
}
