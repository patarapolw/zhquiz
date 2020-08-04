/* eslint-disable no-console */
import { zh, zhDict, zhInit } from '@/db/local'

async function main() {
  await zhInit()

  console.log(
    zhDict.sentence
      .find()
      .reduce(
        (prev, { entry }) => (prev < entry.length ? entry.length : prev),
        0
      )
  )

  zh.close()
}

if (require.main === module) {
  main()
}
