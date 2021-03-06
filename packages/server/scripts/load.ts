import S from 'jsonschema-definer'
import fs from 'fs'
import mongodb from 'mongodb'
import yaml from 'js-yaml'

async function main() {
  const client = await mongodb.connect(process.env.MONGO_URI!, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  const col = client.db('library').collection<{
    title: string
    entries: string[]
    source: string
    createdAt: Date
  }>('library')

  await col.deleteMany({})

  // await col.createIndex({ title: 'text', entries: 'text' })

  const schema = S.list(
    S.shape({
      title: S.string(),
      children: S.list(
        S.shape({
          title: S.string(),
          entries: S.list(S.string())
        })
      )
    })
  )

  let now = +new Date()

  await col.insertMany(
    schema
      .ensure(
        yaml.load(fs.readFileSync('../../assets/libraryx.yaml', 'utf-8')) as any
      )
      .flatMap(({ title: t1, children }) => {
        return children.map(({ title: t2, entries }) => {
          return {
            title: `${t1} / ${t2}`,
            entries,
            source: 'libraryx.yaml',
            createdAt: new Date(now++)
          }
        })
      })
  )

  await client.close()
}

if (require.main === module) {
  main()
}
