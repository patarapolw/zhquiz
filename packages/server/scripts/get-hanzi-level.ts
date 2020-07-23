import fs from 'fs'

import yaml from 'js-yaml'
import XRegExp from 'xregexp'

async function main() {
  const reHan = XRegExp('\\p{Han}', 'g')
  const hskYaml = fs.readFileSync('assets/hsk.yaml', 'utf8')
  const hsk = yaml.safeLoad(hskYaml) as Record<string, string[]>

  const out: {
    [lv: string]: {
      hanzi: string[]
      vocab: string[]
    }
  } = {}

  const hLevelMap = new Map<string, number>()

  Object.entries(hsk).map(([_lv, vs]) => {
    const lvMap = {
      hanzi: [] as string[],
      vocab: vs,
    }
    out[_lv] = lvMap

    const lv = parseInt(_lv)
    vs.map((v) => {
      ;(v.match(reHan) || []).map((h) => {
        const prevLv = hLevelMap.get(h)
        if (!prevLv || prevLv > lv) {
          hLevelMap.set(h, lv)
        }
      })
    })
  })
  Array.from(hLevelMap).map(([h, lv]) => {
    out[lv.toString()].hanzi.push(h)
  })

  fs.writeFileSync(
    'assets/hanzi-level.yaml',
    yaml.safeDump(
      Object.entries(out).map(([_lv, el]) => ({
        level: parseInt(_lv),
        hanzi: el.hanzi.join(''),
        vocab: el.vocab,
      })),
      {
        flowLevel: 2,
      }
    )
  )
}

if (require.main === module) {
  main().catch(console.error)
}
