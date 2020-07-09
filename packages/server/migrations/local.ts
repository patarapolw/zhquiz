import fs from 'fs'

import sqlite3 from 'better-sqlite3'
// @ts-ignore
import makePinyin from 'chinese-to-pinyin'
import yaml from 'js-yaml'
import S from 'jsonschema-definer'
import XRegExp from 'xregexp'

import {
  sDictionary,
  sToken,
  zh,
  zhDictionary,
  zhInit,
  zhToken,
} from '@/db/local'
import { ensureSchema } from '@/schema-util'

async function main() {
  // require('log-buffer')
  const reHan1 = XRegExp('^\\p{Han}$')
  const reHan = XRegExp('\\p{Han}', 'g')

  const db = sqlite3('assets/zh.db', { readonly: true })

  const hskRaw = fs.readFileSync('assets/hsk.yaml', 'utf8')
  const simpChars = new Set(hskRaw.match(reHan))

  const hsk: Record<string, string[]> = yaml.safeLoad(hskRaw)
  const hMap = new Map<string, number>()
  const vMap = new Map<string, number>()

  Object.entries(hsk)
    .map(([lv, vs]) => ({ lv: parseInt(lv), vs }))
    .map(({ lv, vs }) => {
      vs.map((v) => {
        ;(v.match(reHan) || []).map((h) => {
          const hLevel = hMap.get(h)
          if (!hLevel || hLevel > lv) {
            hMap.set(h, lv)
          }
        })

        const vLevel = vMap.get(v)
        if (!vLevel) {
          vMap.set(v, lv)
        }
      })
    })

  const olRegex = /^\s*\d+\.\s*/g
  const cleanOl = (s: string) => {
    ensureSchema(S.string(), s)

    if (s && olRegex.test(s)) {
      return s.replace(olRegex, '')
    }

    return s
  }

  const addSpaceToSlash = (s: string) => {
    ensureSchema(S.string(), s)

    const indices = indicesOf(s, '/')
    if (indices.length > 0) {
      indices.map((c, i) => {
        c += i * 2
        s = s.substr(0, c) + ' / ' + s.substr(c + 1)
      })
    }

    return s
  }

  await zhInit()
  db.prepare(
    /* sql */ `
  SELECT chinese, pinyin, english, frequency, [level] FROM sentence
  `
  )
    .all()
    .map(({ chinese, pinyin, english, frequency, level }) => {
      const entry = cleanOl(chinese)

      const item: typeof sDictionary.type = {
        entry,
        reading: [pinyin || makePinyin(entry, { keepRest: true })],
        translation: [cleanOl(english)],
        frequency: frequency || undefined,
        level: level || undefined,
        priority:
          (Array.from<string>(chinese.match(reHan)).every((c) =>
            simpChars.has(c)
          )
            ? 4
            : 3) + (/a-z/i.test(chinese) ? -2 : 0),
        type: 'sentence',
      }

      zhDictionary.insertOne(ensureSchema(sDictionary, item))
    })

  db.prepare(
    /* sql */ `
  SELECT [entry], sub, sup, [var] variants, frequency, tag, pinyin, english
  FROM token
  `
  )
    .all()
    .map(({ entry, sub, sup, variants, frequency, tag, pinyin, english }) => {
      if (reHan1.test(entry)) {
        const token: typeof sToken.type = {
          entry,
          sub: sub || undefined,
          sup: sup || undefined,
          variants: variants || undefined,
        }

        zhToken.insertOne(ensureSchema(sToken, token))

        if (english) {
          const item: typeof sDictionary.type = {
            entry,
            frequency: frequency || undefined,
            level: hMap.get(entry),
            tag: tag ? tag.split(' ') : undefined,
            reading: [pinyin || makePinyin(entry, { keepRest: true })],
            translation: [addSpaceToSlash(english)],
            type: 'hanzi',
          }

          zhDictionary.insertOne(ensureSchema(sDictionary, item))
        }
      }
    })

  db.prepare(
    /* sql */ `
  SELECT simplified, traditional, v.pinyin pinyin, v.english english, frequency
  FROM vocab v
  LEFT JOIN token t ON simplified = [entry]
  `
  )
    .all()
    .map(({ simplified, traditional, pinyin, english, frequency }) => {
      const entry = simplified

      const item: typeof sDictionary.type = {
        entry,
        alt: traditional ? [traditional] : undefined,
        frequency: frequency || undefined,
        level: vMap.get(entry),
        reading: [pinyin || makePinyin(entry, { keepRest: true })],
        translation: [addSpaceToSlash(english)],
        type: 'vocab',
      }

      zhDictionary.insertOne(ensureSchema(sDictionary, item))
    })

  zh.save(() => {
    zh.close()
  })

  db.close()
}

function notSpace(c: string) {
  return c && c !== ' '
}

function indicesOf(str: string, c: string) {
  const indices: number[] = []
  for (let i = 0; i < str.length; i++) {
    if (str[i] === c && notSpace(str[i - 1]) && notSpace(str[i + 1])) {
      indices.push(i)
    }
  }

  return indices
}

if (require.main === module) {
  main()
}
