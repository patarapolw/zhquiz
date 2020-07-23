import fs from 'fs'

import yaml from 'js-yaml'
import S from 'jsonschema-definer'
import Loki, { Collection } from 'lokijs'
import XRegExp from 'xregexp'

import { sLevel } from '../util/schema'

export const template = yaml.safeLoad(
  fs.readFileSync('assets/template.yaml', 'utf8')
) as {
  [type: string]: {
    [direction: string]: {
      // required?: string[]
      front: string
      back: string
    }
  }
}

export let zh: Loki

export const sSentence = S.shape({
  chinese: S.string(),
  pinyin: S.string().optional(),
  english: S.string().optional(),
  frequency: S.number().optional(),
  level: sLevel.optional(),
  priority: S.number().optional(),
})

export let zhSentence: Collection<typeof sSentence.type>

const reHan1 = XRegExp('^\\p{Han}$')

export const sToken = S.shape({
  entry: S.string().custom((s) => reHan1.test(s)),
  sub: S.string().optional(),
  sup: S.string().optional(),
  variants: S.string().optional(),
  frequency: S.number().optional(),
  level: sLevel.optional(),
  tag: S.list(S.string()).minItems(1).uniqueItems().optional(),
  pinyin: S.string().optional(),
  english: S.string().optional(),
})

export let zhToken: Collection<typeof sToken.type>

export const sVocab = S.shape({
  simplified: S.string(),
  traditional: S.list(S.string()).minItems(1).uniqueItems().optional(),
  pinyin: S.list(S.string()).minItems(1).uniqueItems(),
  english: S.list(S.string()).minItems(1).uniqueItems(),
  frequency: S.number().optional(),
  level: sLevel.optional(),
})

export let zhVocab: Collection<typeof sVocab.type>

export async function zhInit(filename = 'assets/zh.loki') {
  return new Promise((resolve) => {
    zh = new Loki(filename, {
      autoload: true,
      autoloadCallback: async () => {
        zhSentence = zh.getCollection('sentence')
        if (!zhSentence) {
          zhSentence = zh.addCollection('sentence', {
            unique: ['chinese'],
          })
        }

        zhToken = zh.getCollection('token')
        if (!zhToken) {
          zhToken = zh.addCollection('token', {
            unique: ['entry'],
          })
        }

        zhVocab = zh.getCollection('vocab')
        if (!zhVocab) {
          zhVocab = zh.addCollection('vocab', {
            unique: ['simplified'],
          })
        }

        resolve()
      },
    })
  })
}
