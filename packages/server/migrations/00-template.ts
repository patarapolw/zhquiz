import { mongoose } from '@typegoose/typegoose'
import fs from 'fs-extra'
import yaml from 'js-yaml'

import { DbTemplateModel } from '@/db/mongo'

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

  const rs = await DbTemplateModel.insertMany(
    Object.entries(template).flatMap(([type, m]) =>
      Object.entries(m).map(([direction, { front, back }]) => ({
        name: `zhquiz/${type}`,
        direction,
        front,
        back,
        userId: ['zhquiz'],
      }))
    )
  )

  fs.ensureFileSync('assets/mongo/template.json')
  fs.writeFileSync(
    'assets/mongo/template.json',
    JSON.stringify(
      rs.map(({ _id, name, direction, userId }) => ({
        _id,
        name,
        direction,
        userId,
      }))
    )
  )

  mongoose.disconnect()
}

if (require.main === module) {
  main()
}
