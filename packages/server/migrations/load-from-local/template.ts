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
        required?: string[]
        front: string
        back?: string
      }
    }
  }

  console.log(
    Object.keys(template).map((type) => ({
      name: 'zhquiz-card-template',
      langFrom: 'chinese',
      langTo: 'english',
      type: type !== 'extra' ? type : undefined,
      userId: ['default'],
      tag: ['template', 'zhquiz'],
    }))
  )

  const cats = await DbCategoryModel.insertMany(
    Object.keys(template).map((type) => ({
      name: 'zhquiz-card-template',
      langFrom: 'chinese',
      langTo: 'english',
      type: type !== 'extra' ? type : undefined,
      userId: ['default'],
      tag: ['template', 'zhquiz'],
    }))
  )

  await DbTemplateModel.insertMany(
    Object.entries(template).flatMap(([type, m]) =>
      Object.entries(m).map(
        ([direction, { front, back, required: requiredFields }]) => ({
          categoryId: cats.filter((c) => {
            return c.type === (type !== 'extra' ? type : undefined)
          })[0]._id,
          direction,
          front,
          back,
          requiredFields,
        })
      )
    )
  )
}

async function cleanup() {
  await DbCategoryModel.purgeMany('default', {
    $and: [{ tag: 'template' }, { tag: 'zhquiz' }],
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
