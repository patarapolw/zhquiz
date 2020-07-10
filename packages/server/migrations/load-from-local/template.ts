import fs from 'fs'

import yaml from 'js-yaml'

import { DbCategoryModel, DbTemplateModel } from '@/db/mongo'
import { mongoInit } from '@/util/mongo'

export async function loadChineseTemplate() {
  const template = yaml.safeLoad(
    fs.readFileSync('assets/zh-card.yaml', 'utf8')
  ) as {
    [type: string]: {
      [direction: string]: {
        front: string
        back?: string
      }
    }
  }

  Object.entries(template).flatMap(([type, m]) =>
    Object.entries(m).map(([direction, { front, back }]) => ({
      type,
      direction,
      front,
      back,
    }))
  )

  const cats = await DbCategoryModel.insertMany(
    Object.keys(template).map((type) => ({
      name: 'zhquiz-card-template',
      langFrom: 'chinese',
      langTo: 'english',
      type: type !== 'extra' ? type : undefined,
      userId: ['default'],
      tag: ['zhquiz'],
    }))
  )

  await DbTemplateModel.insertMany(
    Object.entries(template).flatMap(([type, m]) =>
      Object.entries(m).map(([direction, { front, back }]) => ({
        categoryId: cats.filter((c) => c.type === type)[0]._id,
        direction,
        front,
        back,
      }))
    )
  )
}

async function cleanup() {
  await DbCategoryModel.purgeMany('default', {
    tag: 'zhquiz',
  })
}

if (require.main === module) {
  ;(async () => {
    const mongoose = await mongoInit()
    await cleanup()
    await loadChineseTemplate()
    await mongoose.disconnect()
  })()
}
