import fs from 'fs'

import sqlite3 from 'better-sqlite3'
import makePinyin from 'chinese-to-pinyin'
import yaml from 'js-yaml'
import S from 'jsonschema-definer'
import XRegExp from 'xregexp'

import {
  ensureSchema,
  sDict,
  sToken,
  zh,
  zhDict,
  zhInit,
  zhToken,
} from '@/db/local'

async function main() {
  // require('log-buffer')
  const reHan1 = XRegExp('^\\p{Han}$')
  const reHan = XRegExp('\\p{Han}', 'g')

  const db = sqlite3('assets/zh.db', { readonly: true })
  const { levelMap, simpChars } = (() => {
    const txt = fs.readFileSync('assets/hsk.yaml', 'utf8')
    const hsk = yaml.safeLoad(txt) as Record<string, string[]>
    const levelMap = {
      hanzi: new Map<string, number>(),
      vocab: new Map<string, number>(),
    }

    Object.entries(hsk).map(([_lv, vs]) => {
      const level = parseInt(_lv)
      vs.map((v) => {
        levelMap.vocab.set(v, level)
        ;(v.match(reHan) || []).map((h) => {
          const prevLv = levelMap.hanzi.get(h)
          if (!prevLv || prevLv < level) {
            levelMap.hanzi.set(h, level)
          }
        })
      })
    })

    return {
      levelMap,
      simpChars: new Set(txt.match(reHan)),
    }
  })()

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

  {
    const itMap = new Map<string, typeof sDict.type>()

    db.prepare(
      /* sql */ `
    SELECT chinese, pinyin, english, frequency, [level] FROM sentence
    `
    )
      .all()
      .map(({ chinese, pinyin, english, frequency, level }) => {
        const entry = cleanOl(chinese)
        mergeSimilarEntries(itMap, {
          entry,
          reading: pinyin ? [pinyin] : undefined,
          english: [cleanOl(english)],
          frequency: frequency || undefined,
          level: level || undefined,
        })
      })

    const maxFreq =
      Math.max(
        ...Array.from(itMap.values())
          .map(({ frequency }) => frequency!)
          .filter((f) => f)
      ) + 1

    const getPriority = (ent: string) => {
      return (
        (Array.from<string>(ent.match(reHan) || []).every((c) =>
          simpChars.has(c)
        )
          ? 4
          : 3) + (/a-z/i.test(ent) ? -2 : 0)
      )
    }

    zhDict.sentence.insert(
      Array.from(itMap.values()).map((d) => {
        if (d.frequency) {
          d.frequency = getPriority(d.entry) + d.frequency / maxFreq
        }

        return ensureSchema(sDict, d)
      })
    )
  }

  {
    const itMap = new Map<string, typeof sDict.type>()
    const tokenMap = new Map<string, typeof sToken.type>()
    const hanSplit = (s: string | null) => {
      const arr = (s || '').match(reHan) || []
      return arr.length ? Array.from(arr) : undefined
    }

    db.prepare(
      /* sql */ `
    SELECT [entry], sub, sup, [var] variants, frequency, pinyin, english
    FROM token
    `
    )
      .all()
      .map(({ entry, sub, sup, variants, frequency, pinyin, english }) => {
        if (reHan1.test(entry)) {
          tokenMap.set(
            entry,
            ensureSchema(sToken, {
              entry,
              sub: hanSplit(sub),
              sup: hanSplit(sup),
              variants: hanSplit(variants),
              frequency: frequency || undefined,
            })
          )

          if (english) {
            mergeSimilarEntries(itMap, {
              entry,
              reading: pinyin ? [pinyin] : undefined,
              english: [addSpaceToSlash(english)],
              frequency: frequency || undefined,
              level: levelMap.hanzi.get(entry),
            })
          }
        }
      })

    zhToken.insert(Array.from(tokenMap.values()))
    zhDict.hanzi.insert(Array.from(itMap.values()))
  }

  {
    const itMap = new Map<string, typeof sDict.type>()

    db.prepare(
      /* sql */ `
    SELECT simplified, traditional, v.pinyin pinyin, v.english english, frequency
    FROM vocab v
    LEFT JOIN token t ON simplified = [entry]
    `
    )
      .all()
      .map(({ simplified, traditional, pinyin, english, frequency }) => {
        mergeSimilarEntries(itMap, {
          entry: simplified,
          alt: traditional ? [traditional] : undefined,
          reading: pinyin ? [pinyin] : undefined,
          english: [addSpaceToSlash(english)],
          frequency: frequency || undefined,
          level: levelMap.vocab.get(simplified),
        })
      })

    zhDict.vocab.insert(Array.from(itMap.values()))
  }

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

function mergeSimilarEntries(
  itMap: Map<string, typeof sDict.type>,
  d: Omit<typeof sDict.type, 'reading'> & {
    reading?: string[]
  }
) {
  const dup = itMap.get(d.entry)

  if (dup) {
    const alt = dup.alt || []
    alt.push(...(d.alt || []))
    if (alt.length) {
      dup.alt = [...new Set(alt)].sort()
    }

    if (d.reading) {
      dup.reading.push(...d.reading)
      dup.reading = [...new Set(dup.reading)].sort()
    }

    dup.english.push(...d.english)
    dup.english = [...new Set(dup.english)].sort()
    itMap.set(d.entry, ensureSchema(sDict, dup))
  } else {
    itMap.set(
      d.entry,
      ensureSchema(sDict, {
        ...d,
        reading: d.reading || [makePinyin(d.entry, { keepRest: true })],
      })
    )
  }
  return itMap
}

if (require.main === module) {
  main()
}
