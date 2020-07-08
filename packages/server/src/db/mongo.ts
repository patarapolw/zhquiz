import {
  getModelForClass,
  index,
  prop,
  Ref,
  setGlobalOptions,
  Severity,
} from '@typegoose/typegoose'
import dotProp from 'dot-prop-immutable'
import { nanoid } from 'nanoid'

import { getNextReview, repeatReview, srsMap } from './quiz'

setGlobalOptions({ options: { allowMixed: Severity.ALLOW } })

export class DbUser {
  @prop({ required: true, unique: true }) email!: string
  @prop() name!: string
  @prop({ default: 1 }) levelMin?: number
  @prop({ default: 60 }) level?: number
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
    await DbCardModel.purgeMany(userId)
    await DbUserModel.deleteOne({ userId })
  }
}

export const DbUserModel = getModelForClass(DbUser, {
  schemaOptions: { collection: 'user', timestamps: true },
})

@index({ userId: 1, type: 1, item: 1, direction: 1 }, { unique: true })
export class DbCard {
  @prop({ default: () => nanoid() }) _id!: string
  @prop({ required: true, index: true, ref: 'DbUser' }) userId!: Ref<DbUser>
  @prop({ required: true }) type!: string
  @prop({ required: true }) item!: string
  @prop({ required: true }) direction!: string
  @prop({ default: '' }) front?: string
  @prop({ default: '' }) back?: string
  @prop({ default: '' }) mnemonic?: string
  @prop({ default: () => [] }) tag?: string[]

  static async purgeMany(userId: string, cond?: any) {
    cond = cond
      ? {
          $and: [cond, { userId }],
        }
      : { userId }

    await DbQuizModel.deleteMany({
      cardId: {
        $in: (await DbCardModel.find(cond).select({ _id: 1 })).map(
          (el) => el._id
        ),
      },
    })

    await DbCardModel.deleteMany(cond)
  }
}

export const DbCardModel = getModelForClass(DbCard, {
  schemaOptions: { collection: 'card', timestamps: true },
})

class DbQuiz {
  @prop({ default: () => repeatReview() }) nextReview?: Date
  @prop({ default: 0 }) srsLevel?: number
  @prop({ default: () => ({}) }) stat?: {
    streak?: {
      right?: number
      wrong?: number
      maxRight?: number
      maxWrong?: number
    }
    lastRight?: Date
    lastWrong?: Date
  }

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
      this.stat = this.stat || {}

      if (dSrsLevel > 0) {
        this.stat = dotProp.set(
          this.stat,
          'streak.right',
          dotProp.get(this.stat, 'streak.right', 0) + 1
        )
        this.stat = dotProp.set(this.stat, 'streak.wrong', 0)
        this.stat = dotProp.set(this.stat, 'lastRight', new Date())

        if (
          dotProp.get(this.stat, 'streak.right', 1) >
          dotProp.get(this.stat, 'streak.maxRight', 0)
        ) {
          this.stat = dotProp.set(
            this.stat,
            'streak.maxRight',
            dotProp.get(this.stat, 'streak.right', 1)
          )
        }
      } else if (dSrsLevel < 0) {
        this.stat = dotProp.set(
          this.stat,
          'streak.wrong',
          dotProp.get(this.stat, 'streak.wrong', 0) + 1
        )
        this.stat = dotProp.set(this.stat, 'streak.right', 0)
        this.stat = dotProp.set(this.stat, 'lastWrong', new Date())

        if (
          dotProp.get(this.stat, 'streak.wrong', 1) >
          dotProp.get(this.stat, 'streak.maxWrong', 0)
        ) {
          this.stat = dotProp.set(
            this.stat,
            'streak.maxWrong',
            dotProp.get(this.stat, 'streak.wrong', 1)
          )
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

@index({ userId: 1, chinese: 1 }, { unique: true })
class DbExtra {
  @prop({ default: () => nanoid() }) _id!: string
  @prop({ required: true, index: true, ref: 'DbUser' }) userId!: Ref<DbUser>
  @prop({ required: true }) chinese!: string
  @prop() pinyin?: string
  @prop({ required: true }) english!: string

  static async purgeMany(userId: string, cond?: any) {
    cond = cond
      ? {
          $and: [cond, { userId }],
        }
      : { userId }

    const rs = await DbExtraModel.find(cond).select({
      chinese: 1,
    })

    if (rs.length > 0) {
      await DbCardModel.deleteMany({
        item: { $in: rs.map((el) => el.chinese!) },
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
