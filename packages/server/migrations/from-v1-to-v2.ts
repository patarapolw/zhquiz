/* eslint-disable no-console */
import { Serialize } from 'any-serialize'
import { ObjectID } from 'mongodb'
import { nanoid } from 'nanoid'

import { zhDict, zhInit } from '@/db/local'
import { DbExtraModel, DbQuizModel, DbUserModel } from '@/db/mongo'
import { mongoInit } from '@/util/mongo'

import { V1Extra, V1User } from './v1'

async function main() {
  const mongoose = await mongoInit()
  const v1 = mongoose.connection.useDb('test').db

  const oldUsers = (await DbUserModel.find().select('_id email')).reduce(
    (prev, { _id, email }) => {
      prev.set(email, _id)
      return prev
    },
    new Map<string, string>()
  )
  /**
   * From ObjectID to string
   */
  const userIdMap = new Map<string, string>()

  await DbUserModel.insertMany(
    (
      await v1
        .collection<V1User>('user')
        .find()
        .project({
          level: 0,
          levelMin: 0,
        })
        .toArray()
    )
      .map(({ _id: userIdObjectId, ...others }) => {
        const userId = oldUsers.get(others.email)
        if (userId) {
          userIdMap.set(userIdObjectId.toHexString(), userId)
          return null
        }

        const _id = nanoid()
        userIdMap.set(userIdObjectId.toHexString(), _id)

        return {
          ...others,
          _id,
        }
      })
      .filter((el) => el)
  )

  const qs = await DbQuizModel.find().select('_id')
  await zhInit()

  const ser = new Serialize()
  const toMigrateQsMap = new Map<string, any>()

  ;(
    await v1
      .collection('card')
      .aggregate([
        ...(qs.length
          ? [
              {
                $match: {
                  _id: {
                    $nin: qs.map(({ _id }) => _id),
                  },
                },
              },
            ]
          : []),
        {
          $lookup: {
            from: 'quiz',
            localField: 'cardId',
            foreignField: '_id',
            as: 'q',
          },
        },
        {
          $project: {
            /**
             * cardId of old db is quizId of new db
             */
            _id: 1,
            userIdObjectId: '$userId',
            type: 1,
            item: 1,
            direction: 1,
            front: 1,
            back: 1,
            mnemonic: 1,
            tag: 1,
            createdAt: 1,
            updatedAt: 1,
            nextReview: { $arrayElemAt: ['$q.nextReview', 0] },
            srsLevel: { $arrayElemAt: ['$q.srsLevel', 0] },
            stat: { $arrayElemAt: ['$q.stat', 0] },
          },
        },
      ])
      .toArray()
  ).map(
    ({
      userIdObjectId,
      front = '',
      back = '',
      mnemonic = '',
      tag = [],
      item: entry,
      type,
      direction,
      ...others
    }: {
      userIdObjectId: ObjectID
      /**
       * @default ''
       */
      front: string
      /**
       * @default ''
       */
      back: string
      /**
       * @default ''
       */
      mnemonic: string
      /**
       * @default []
       */
      tag: string[]
      item: string
      type: 'hanzi' | 'vocab' | 'sentence' | 'extra'
      direction: 'se' | 'te' | 'ec'
      srsLevel?: number
    }) => {
      let entries = [entry]

      if (direction === 'te') {
        const v = zhDict.vocab.by('entry', entry)
        if (!v) {
          throw new Error(`Cannot find entry: ${entry}`)
        }

        if (!v.alt) {
          throw new Error(`Cannot find alt of: ${entry}`)
        }
        entries = v.alt
      }

      entries.map((entry) => {
        const data = {
          ...others,
          entry,
          type:
            type === 'extra'
              ? `extra-${direction}`
              : direction === 'ec'
              ? `${type}-ec`
              : 'char-ce',
          userId: userIdMap.get(userIdObjectId.toHexString()),
          front: front || undefined,
          back: back || undefined,
          mnemonic: mnemonic || undefined,
          tag: tag.length ? tag : undefined,
        }

        const key = ser.hash({
          userId: data.userId,
          type: data.type,
          entry: data.entry,
        })
        const oldData = toMigrateQsMap.get(key)
        if (
          !oldData ||
          (oldData && data.srsLevel && data.srsLevel > (oldData.srsLevel || -1))
        ) {
          toMigrateQsMap.set(key, data)
        }
      })
    }
  )

  if (toMigrateQsMap.size) {
    try {
      await DbQuizModel.insertMany(Array.from(toMigrateQsMap.values()), {
        ordered: false,
      })
    } catch (e) {
      console.error(e)
    }
  }

  const xs = await DbExtraModel.find().select('_id')
  const toMigrateXs = (
    await v1
      .collection<V1Extra>('extra')
      .find(
        xs.length
          ? {
              _id: {
                $nin: xs.map(({ _id }) => _id),
              },
            }
          : {}
      )
      .toArray()
  ).map(({ userId: userIdObjectId, chinese, pinyin, english, ...others }) => {
    return {
      ...others,
      entry: chinese,
      reading: pinyin,
      english,
      userId: userIdMap.get(userIdObjectId.toHexString()),
    }
  })

  if (toMigrateXs.length) {
    await DbExtraModel.insertMany(toMigrateXs)
  }

  await mongoose.disconnect()
}

if (require.main === module) {
  main()
}
