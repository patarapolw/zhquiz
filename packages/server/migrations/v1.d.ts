import { ObjectID } from 'mongodb'

type ITimestamp<T> = T & {
  createdAt: Date
  updatedAt: Date
}

interface DbUser {
  _id: ObjectID
  email: string
  name: string
  levelMin?: number
  level?: number
  settings?: Record<string, any>
}

export type V1User = ITimestamp<DbUser>

interface DbCard {
  _id: string
  userId: ObjectID
  type: string
  item: string
  direction: string
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
}

export type V1Card = ITimestamp<DbCard>

interface DbQuiz {
  nextReview: Date
  srsLevel: number
  stat: {
    streak?: {
      right: number
      wrong: number
      maxRight: number
      maxWrong: number
    }
    lastRight?: Date
    lastWrong?: Date
  }

  cardId: string
}

export type V1Quiz = ITimestamp<DbQuiz>

interface DbExtra {
  _id: string
  userId: ObjectID
  chinese: string
  pinyin: string
  english: string
}

export type V1Extra = ITimestamp<DbExtra>
