import fs from 'fs'

import sqlite3 from 'better-sqlite3'
import makePinyin from 'chinese-to-pinyin'
import yaml from 'js-yaml'
import S from 'jsonschema-definer'
import XRegExp from 'xregexp'

import {
  DbCategoryModel,
  DbItemModel,
  DbTokenModel,
  sDbItem,
  sDbToken,
} from '@/db/mongo'
import { mongoInit } from '@/util/mongo'
import { ensureSchema } from '@/util/schema'

export async function loadChineseDictionaries() {
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

  const mongoose = await mongoInit()

  const tatoeba = await DbCategoryModel.create({
    userId: ['default'],
    name: 'tatoeba-cmn-eng',
    type: 'sentence',
    langFrom: 'chinese',
    langTo: 'english',
    tag: ['tatoeba', 'zhquiz', 'zhlevel'],
  })

  const tatoebaEntries: typeof sDbItem.type[] = []

  db.prepare(
    /* sql */ `
  SELECT chinese, pinyin, english, frequency, [level] FROM sentence
  `
  )
    .all()
    .map(({ chinese, pinyin, english, frequency, level }) => {
      const entry = cleanOl(chinese)

      tatoebaEntries.push(
        ensureSchema(sDbItem, {
          categoryId: tatoeba._id,
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
        })
      )
    })

  await DbItemModel.insertMany(tatoebaEntries, { ordered: false })

  const jundaDict = await DbCategoryModel.create({
    userId: ['default'],
    name: 'junda',
    type: 'hanzi',
    langFrom: 'chinese',
    langTo: 'english',
    tag: ['junda', 'Jun Da', 'zhquiz', 'zhlevel'],
  })

  const jundaDictEntries: typeof sDbItem.type[] = []
  const tokenEntries: typeof sDbToken.type[] = []

  db.prepare(
    /* sql */ `
  SELECT [entry], sub, sup, [var] variants, frequency, tag, pinyin, english
  FROM token
  `
  )
    .all()
    .map(
      ({
        entry,
        sub: sub_,
        sup: sup_,
        variants: var_,
        frequency,
        tag,
        pinyin,
        english,
      }) => {
        if (reHan1.test(entry)) {
          const [sub, sup, variants] = [sub_, sup_, var_]
            .map((el: string = '') => el.match(reHan) || [])
            .filter((a) => a.length)

          tokenEntries.push(
            ensureSchema(sDbToken, {
              _id: entry,
              sub,
              sup,
              variants,
            })
          )

          if (english) {
            jundaDictEntries.push(
              ensureSchema(sDbItem, {
                categoryId: jundaDict._id,
                entry,
                frequency: frequency || undefined,
                level: hMap.get(entry),
                tag: tag ? tag.split(' ') : undefined,
                reading: [pinyin || makePinyin(entry, { keepRest: true })],
                translation: [addSpaceToSlash(english)],
              })
            )
          }
        }
      }
    )

  await Promise.all([
    DbItemModel.insertMany(jundaDictEntries, { ordered: false }),
    DbTokenModel.insertMany(tokenEntries, { ordered: false }),
  ])

  const cedict = await DbCategoryModel.create({
    userId: ['default'],
    name: 'cedict',
    type: 'vocab',
    langFrom: 'chinese',
    langTo: 'english',
    tag: ['cedict', 'mdbg', 'zhquiz', 'zhlevel'],
  })

  const cedictEntries: typeof sDbItem.type[] = []

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

      cedictEntries.push(
        ensureSchema(sDbItem, {
          categoryId: cedict._id,
          entry,
          alt: traditional ? [traditional] : undefined,
          frequency: frequency || undefined,
          level: vMap.get(entry),
          reading: [pinyin || makePinyin(entry, { keepRest: true })],
          translation: [addSpaceToSlash(english)],
        })
      )
    })

  db.close()

  mongoose.disconnect()
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

async function cleanup() {
  await DbTokenModel.deleteMany({})
  await DbCategoryModel.purgeMany('default', {
    tag: 'zhquiz',
  })
}

if (require.main === module) {
  ;(async () => {
    const mongoose = await mongoInit()
    await cleanup()
    await loadChineseDictionaries()
    await mongoose.disconnect()
  })()
}
