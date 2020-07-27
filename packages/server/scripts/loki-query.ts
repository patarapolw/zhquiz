/* eslint-disable no-console */
import { zh, zhDict, zhInit } from '@/db/local'

async function main() {
  await zhInit()

  const qs = ['放開', '改革开放']

  console.log(
    zhDict.vocab.find({
      $or: [{ entry: { $in: qs } }, { alt: { $in: qs } }],
    })
  )

  zh.close()
}

if (require.main === module) {
  main()
}
