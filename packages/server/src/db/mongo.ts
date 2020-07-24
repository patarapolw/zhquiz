import {
  getModelForClass,
  index,
  prop,
  setGlobalOptions,
  Severity,
} from '@typegoose/typegoose'
import S from 'jsonschema-definer'
import { nanoid } from 'nanoid'

import { sDateTime, sStringNonEmpty } from '@/util/schema'

import { getNextReview, repeatReview, srsMap } from './quiz'

setGlobalOptions({ options: { allowMixed: Severity.ALLOW } })

export class DbUser {
  @prop({ default: () => nanoid() }) _id?: string
  @prop({ required: true, unique: true }) email!: string
  @prop() name!: string
  @prop() settings?: Record<string, any>

  static async signIn(email: string, name: string) {
    let user = await DbUserModel.findOne({ email })
    if (!user) {
      user = await DbUserModel.create({ email, name })
    }

    if (!user.name) {
      DbUserModel.updateOne(
        { email },
        {
          $set: { name },
        }
      )
    }

    return user
  }

  static async purgeOne(userId: string) {
    await DbExtraModel.purgeMany(userId)
    await DbQuizModel.deleteMany({ userId })
    await DbUserModel.deleteOne({ userId })
  }
}

export const DbUserModel = getModelForClass(DbUser, {
  schemaOptions: { collection: 'user', timestamps: true },
})

export const sQuizStat = S.shape({
  streak: S.shape({
    right: S.integer().minimum(0),
    wrong: S.integer().minimum(0),
    maxRight: S.integer().minimum(0),
    maxWrong: S.integer().minimum(0),
  }),
  lastRight: sDateTime.optional(),
  lastWrong: sDateTime.optional(),
})

export const sDbQuiz = S.shape({
  type: S.string().optional(),
  front: S.string().optional(),
  back: S.string().optional(),
  mnemonic: S.string().optional(),
  tag: S.list(S.string()).optional(),
  nextReview: sDateTime.optional(),
  srsLevel: S.integer().optional(),
  stat: sQuizStat.optional(),
})

@index({ userId: 1, type: 1, entry: 1, direction: 1 }, { unique: true })
class DbQuiz {
  @prop({ default: () => nanoid() }) _id?: string
  @prop({ required: true, index: true, ref: 'DbUser' }) userId!: string
  @prop({ required: true }) type!: string
  @prop({ required: true }) entry!: string
  @prop({ default: '' }) front?: string
  @prop({ default: '' }) back?: string
  @prop({ default: '' }) mnemonic?: string
  @prop({ default: () => [] }) tag?: string[]
  @prop() nextReview?: Date
  @prop() srsLevel?: number
  @prop() stat?: typeof sQuizStat.type

  @prop({ required: true }) cardId!: string

  markRight() {
    return this._updateSrsLevel(+1)()
  }

  markWrong() {
    return this._updateSrsLevel(-1)()
  }

  markRepeat() {
    return this._updateSrsLevel(0)()
  }

  private _updateSrsLevel(dSrsLevel: number) {
    return () => {
      this.stat = this.stat || {
        streak: {
          right: 0,
          wrong: 0,
          maxRight: 0,
          maxWrong: 0,
        },
      }

      if (dSrsLevel > 0) {
        this.stat.streak.right++
        this.stat.streak.wrong = 0
        this.stat.lastRight = new Date()

        if (this.stat.streak.right > this.stat.streak.maxRight) {
          this.stat.streak.maxRight = this.stat.streak.right
        }
      } else if (dSrsLevel < 0) {
        this.stat.streak.wrong++
        this.stat.streak.right = 0
        this.stat.lastWrong = new Date()

        if (this.stat.streak.wrong > this.stat.streak.maxWrong) {
          this.stat.streak.maxWrong = this.stat.streak.wrong
        }
      }

      this.srsLevel = this.srsLevel || 0

      this.srsLevel += dSrsLevel

      if (this.srsLevel >= srsMap.length) {
        this.srsLevel = srsMap.length - 1
      }

      if (this.srsLevel < 0) {
        this.srsLevel = 0
      }

      if (dSrsLevel > 0) {
        this.nextReview = getNextReview(this.srsLevel)
      } else {
        this.nextReview = repeatReview()
      }
    }
  }
}

export const DbQuizModel = getModelForClass(DbQuiz, {
  schemaOptions: { collection: 'quiz', timestamps: true },
})

export const sDbExtra = S.shape({
  _id: S.string().optional(),
  entry: S.string().optional(),
  reading: S.string().optional(),
  english: S.string().optional(),
  updatedAt: sDateTime.optional(),
})

export const sDbExtraCreate = S.shape({
  entry: sStringNonEmpty,
  reading: sStringNonEmpty.optional(),
  english: sStringNonEmpty,
})

@index({ userId: 1, entry: 1 }, { unique: true })
class DbExtra {
  @prop({ default: () => nanoid() }) _id?: string
  @prop({ required: true, index: true, ref: 'DbUser' }) userId!: string
  @prop({ required: true }) entry!: string
  @prop({ required: true }) reading!: string
  @prop({ required: true }) english!: string

  static async purgeMany(userId: string, cond?: any) {
    cond = cond
      ? {
          $and: [cond, { userId }],
        }
      : { userId }

    const rs = await DbExtraModel.find(cond).select('-_id entry')

    if (rs.length > 0) {
      await DbQuizModel.deleteMany({
        entry: { $in: rs.map((el) => el.entry) },
        type: 'extra',
        userId,
      })

      await Promise.all(rs.map((el) => el.remove()))
    }
  }
}

export const DbExtraModel = getModelForClass(DbExtra, {
  schemaOptions: { collection: 'extra', timestamps: true },
})
