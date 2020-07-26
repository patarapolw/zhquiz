/* eslint-disable no-console */
import { mongoInit } from '@/util/mongo'

async function main() {
  const mongoose = await mongoInit()
  const v1 = mongoose.connection.useDb('test').db

  console.log(
    await v1
      .collection('card')
      .aggregate([
        {
          $group: {
            _id: '$type',
            direction: { $addToSet: '$direction' },
          },
        },
      ])
      .toArray()
  )

  await mongoose.disconnect()
}

if (require.main === module) {
  main()
}
