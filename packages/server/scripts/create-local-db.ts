import fs from 'fs'

import sqlite3 from 'better-sqlite3'
import makePinyin from 'chinese-to-pinyin'
import yaml from 'js-yaml'
import S from 'jsonschema-definer'
import XRegExp from 'xregexp'

import {
  sSentence,
  sToken,
  sVocab,
  zh,
  zhInit,
  zhSentence,
  zhToken,
  zhVocab,
} from '../src/db/local'
import { ensureSchema } from '../src/util/schema'

async function main() {
  // require('log-buffer')
  const reHan1 = XRegExp('^\\p{Han}$')
  const reHan = XRegExp('\\p{Han}', 'g')

  const db = sqlite3('assets/zh.db', { readonly: true })
  const hskYaml = fs.readFileSync('assets/hsk.yaml', 'utf8')
  const hsk = yaml.safeLoad(hskYaml) as Record<string, string[]>
  const simpChars = new Set(hskYaml.match(reHan))

  const olRegex = /^\s*\d+\.\s*/g
  const cleanOl = (s: string) => {
    ensureSchema(S.string(), s)

    if (olRegex.test(s)) {
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

  const sSet = new Set<string>()
  db.prepare(
    /* sql */ `
  SELECT chinese, pinyin, english, frequency, [level] FROM sentence
  `
  )
    .all()
    .map(({ chinese, pinyin, english, frequency, level }) => {
      chinese = cleanOl(chinese)
      if (sSet.has(chinese)) {
        return
      }
      sSet.add(chinese)

      zhSentence.insertOne(
        ensureSchema(sSentence, {
          chinese,
          pinyin: pinyin || makePinyin(chinese, { keepRest: true }),
          english: cleanOl(english),
          frequency: frequency || undefined,
          level: level || undefined,
          priority:
            (Array.from<string>(chinese.match(reHan)).every((c) =>
              simpChars.has(c)
            )
              ? 4
              : 3) + (/a-z/i.test(chinese) ? -2 : 0),
        })
      )
    })

  const maxFreq =
    zhSentence
      .find({
        // @ts-ignore
        frequency: { $exists: true },
      })
      .reduce(
        (prev, { frequency = 0 }) => (prev > frequency ? prev : frequency),
        0
      ) + 1

  zhSentence.updateWhere(
    () => true,
    (s) => {
      if (s.frequency && s.priority) {
        s.priority = s.priority + s.frequency / maxFreq
      }

      return s
    }
  )

  const hLevelMap = new Map<string, number>()
  const vLevelMap = new Map<string, number>()
  Object.entries(hsk).map(([_lv, vs]) => {
    const lv = parseInt(_lv)
    vs.map((v) => {
      vLevelMap.set(v, lv)
      ;(v.match(reHan) || []).map((h) => {
        const prevLv = hLevelMap.get(h)
        if (!prevLv || prevLv < lv) {
          hLevelMap.set(h, lv)
        }
      })
    })
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
        zhToken.insertOne(
          ensureSchema(sToken, {
            entry,
            sub: sub || undefined,
            sup: sup || undefined,
            variants: variants || undefined,
            frequency: frequency || undefined,
            level: hLevelMap.get(entry),
            tag: tag ? tag.split(' ') : undefined,
            pinyin: pinyin || undefined,
            english: english ? addSpaceToSlash(english) : undefined,
          })
        )
      }
    })

  const vMap = new Map<string, any[]>()
  db.prepare(
    /* sql */ `
  SELECT simplified, traditional, v.pinyin pinyin, v.english english, frequency
  FROM vocab v
  LEFT JOIN token t ON simplified = [entry]
  `
  )
    .all()
    .map(({ simplified, traditional, pinyin, english, frequency }) => {
      const data = vMap.get(simplified) || []
      data.push({ traditional, pinyin, english, frequency })
      vMap.set(simplified, data)
    })

  zhVocab.insert(
    Array.from(vMap).flatMap(([simplified, vs]) => {
      const tradSet = new Set<string>()
      const pinSet = new Set<string>()
      const engSet = new Set<string>()
      const freqSet = new Set<number>()

      vs.map(({ traditional, pinyin, english, frequency }) => {
        if (traditional) {
          tradSet.add(traditional)
        }
        pinSet.add(pinyin)
        engSet.add(addSpaceToSlash(english))
        if (frequency) {
          freqSet.add(frequency)
        }
      })

      return ensureSchema(sVocab, {
        simplified,
        traditional: tradSet.size ? Array.from(tradSet).sort() : undefined,
        pinyin: Array.from(pinSet).sort(),
        english: Array.from(engSet).sort(),
        frequency: freqSet.size ? Math.max(...freqSet) : undefined,
        level: vLevelMap.get(simplified),
      })
    })
  )

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
  main().catch(console.error)
}
