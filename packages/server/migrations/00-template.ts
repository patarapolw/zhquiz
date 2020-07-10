import { mongoose } from '@typegoose/typegoose'
import fs from 'fs-extra'
import yaml from 'js-yaml'

import { DbCategoryModel, DbTemplateModel } from '@/db/mongo'

async function main() {
  await mongoose.connect(process.env.MONGO_URI!, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })

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
      name: 'zhquiz',
      language: 'chinese',
      type: type !== 'extra' ? type : undefined,
      userId: ['zhquiz'],
    }))
  )

  const rs = await DbTemplateModel.insertMany(
    Object.entries(template).flatMap(([type, m]) =>
      Object.entries(m).map(([direction, { front, back }]) => ({
        categoryId: cats.filter((c) => c.type === type)[0]._id,
        direction,
        front,
        back,
      }))
    )
  )

  fs.ensureFileSync('assets/mongo/template.json')
  fs.writeFileSync(
    'assets/mongo/template.json',
    JSON.stringify(
      rs.map(({ _id, direction, categoryId }) => ({
        templateId: _id,
        categoryId,
        type: cats.filter((c) => c.id === categoryId)[0].type,
        direction,
      }))
    )
  )

  mongoose.disconnect()
}

if (require.main === module) {
  main()
}
