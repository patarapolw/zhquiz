import fs from 'fs'

import sqlite3 from 'better-sqlite3'
import makePinyin from 'chinese-to-pinyin'
import yaml from 'js-yaml'
import S from 'jsonschema-definer'
import XRegExp from 'xregexp'

import { sDict, sToken, zh, zhDict, zhInit, zhToken } from '@/db/local'
import { ensureSchema } from '@/util/schema'

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

  const sMap = new Map<
    string,
    {
      priority: number
    }
  >()
  db.prepare(
    /* sql */ `
  SELECT chinese, pinyin, english, frequency, [level] FROM sentence
  `
  )
    .all()
    .map(
      ({
        chinese,
        pinyin,
        english,
        frequency,
        level,
      }: {
        chinese: string
        pinyin: string | null
        english: string
        frequency: number | null
        level: number | null
      }) => {
        chinese = cleanOl(chinese)
        if (sMap.has(chinese)) {
          return
        }
        sMap.set(chinese, {
          priority:
            (Array.from<string>(chinese.match(reHan) || []).every((c) =>
              simpChars.has(c)
            )
              ? 4
              : 3) + (/a-z/i.test(chinese) ? -2 : 0),
        })

        zhDict.sentence.insertOne(
          ensureSchema(sDict, {
            entry: chinese,
            reading: [pinyin || makePinyin(chinese, { keepRest: true })],
            english: [cleanOl(english)],
            frequency: frequency || undefined,
            level: level || undefined,
          })
        )
      }
    )

  const maxFreq =
    zhDict.sentence
      .find({
        frequency: { $ne: undefined },
      })
      .reduce(
        (prev, { frequency = 0 }) => (prev > frequency ? prev : frequency),
        0
      ) + 1

  zhDict.sentence.updateWhere(
    () => true,
    (s) => {
      if (s.frequency) {
        const { priority = 0 } = sMap.get(s.entry) || {}
        s.frequency = priority + s.frequency / maxFreq
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
  SELECT [entry], sub, sup, [var] variants, frequency, pinyin, english
  FROM token
  `
  )
    .all()
    .map(
      ({
        entry,
        sub: _sub,
        sup: _sup,
        variants: _v,
        frequency,
        pinyin,
        english,
      }: {
        entry: string
        sub: string | null
        sup: string | null
        variants: string | null
        frequency: number | null
        pinyin: string | null
        english: string | null
      }) => {
        if (reHan1.test(entry)) {
          const sub = Array.from((_sub || '').match(reHan) || [])
          const sup = Array.from((_sup || '').match(reHan) || [])
          const variants = Array.from((_v || '').match(reHan) || [])

          zhToken.insertOne(
            ensureSchema(sToken, {
              entry,
              sub: sub.length ? sub : undefined,
              sup: sup.length ? sup : undefined,
              variants: variants.length ? variants : undefined,
            })
          )

          if (english) {
            zhDict.hanzi.insertOne(
              ensureSchema(sDict, {
                entry,
                frequency: frequency || undefined,
                level: hLevelMap.get(entry),
                reading: [pinyin || makePinyin(entry, { keepRest: true })],
                english: [addSpaceToSlash(english)],
              })
            )
          }
        }
      }
    )

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

  zhDict.vocab.insert(
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

      return ensureSchema(sDict, {
        entry: simplified,
        alt: tradSet.size ? Array.from(tradSet).sort() : undefined,
        reading: Array.from(pinSet).sort(),
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
  main()
}
