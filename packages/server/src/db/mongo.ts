import {
  getModelForClass,
  index,
  prop,
  setGlobalOptions,
  Severity,
} from '@typegoose/typegoose'
import dotProp from 'dot-prop-immutable'
import S from 'jsonschema-definer'
import { nanoid } from 'nanoid'

import { getNextReview, repeatReview, srsMap } from './quiz'

setGlobalOptions({ options: { allowMixed: Severity.ALLOW } })

export const sUserSettings = S.shape({
  level: S.shape({
    whatToShow: S.string(),
  }),
  quiz: S.shape({
    type: S.list(S.string()),
    stage: S.list(S.string()),
    direction: S.list(S.string()),
    isDue: S.boolean(),
  }),
}).partial()

export class DbUser {
  @prop({ required: true, unique: true }) email!: string
  @prop() name!: string
  @prop({ default: 1 }) levelMin?: number
  @prop({ default: 60 }) level?: number
  @prop({
    validate: (s) => typeof s === 'undefined' || !!sUserSettings.validate(s)[1],
  })
  settings?: typeof sUserSettings.type

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
    await DbItemModel.purgeMany(userId)
    await DbQuizModel.deleteMany({ userId })
    await DbUserModel.deleteOne({ userId })
  }
}

export const DbUserModel = getModelForClass(DbUser, {
  schemaOptions: { collection: 'user', timestamps: true },
})

/**
 * User specific
 */

export const sQuizStat = S.shape({
  streak: S.shape({
    right: S.integer().minimum(0),
    wrong: S.integer().minimum(0),
    maxRight: S.integer().minimum(0),
    maxWrong: S.integer().minimum(0),
  }),
  lastRight: S.anyOf(
    S.object().custom((o) => o instanceof Date),
    S.string().format('date-time')
  ).optional(),
  lastWrong: S.anyOf(
    S.object().custom((o) => o instanceof Date),
    S.string().format('date-time')
  ).optional(),
}).partial()

@index({ userId: 1, templateId: 1, entry: 1, direction: 1 }, { unique: true })
export class DbQuiz {
  @prop({ default: () => nanoid() }) _id!: string
  @prop({ required: true }) userId!: string
  @prop({ required: true }) templateId!: string
  @prop({ required: true }) entry!: string
  @prop() front?: string
  @prop() back?: string
  @prop() mnemonic?: string
  @prop() tag?: string[]
  @prop() nextReview?: Date
  @prop() srsLevel?: number
  @prop({
    validate: (s) => typeof s === 'undefined' || !!sQuizStat.validate(s)[1],
  })
  stat?: typeof sQuizStat.type

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

/**
 * Sharable
 */

@index({ name: 1, language: 1, type: 1 }, { unique: true })
export class DbCategory {
  @prop({ default: () => nanoid() }) _id!: string
  @prop({ required: true, validate: (u: string[]) => u.length > 0 })
  userId!: string[]

  @prop({ required: true }) name!: string
  @prop({ required: true }) language!: string
  @prop({ required: true }) type!: string

  @prop() parent?: string
}

export const DbCategoryModel = getModelForClass(DbCategory, {
  schemaOptions: { collection: 'category', timestamps: true },
})

@index({ categoryId: 1, direction: 1 }, { unique: true })
export class DbTemplate {
  @prop({ default: () => nanoid() }) _id!: string
  @prop({ required: true }) categoryId!: string
  @prop({ required: true }) direction!: string

  @prop({ required: true }) front!: string
  @prop() back?: string

  static async purgeMany(userId: string, cond?: any) {
    cond = cond
      ? {
          $and: [cond, { userId }],
        }
      : { userId }

    if (!cond) {
      await DbItemModel.updateMany(
        {},
        {
          $pull: { userId },
        }
      )

      await DbItemModel.deleteMany({ userId: { $size: 0 } })
    }
  }
}

export const DbTemplateModel = getModelForClass(DbTemplate, {
  schemaOptions: { collection: 'template', timestamps: true },
})

@index({ categoryId: 1, entry: 1 }, { unique: true })
class DbItem {
  @prop({ default: () => nanoid() }) _id!: string
  @prop({ required: true }) categoryId!: string
  @prop({ required: true }) entry!: string
  @prop() alt?: string[]
  @prop() reading?: string[]
  @prop() translation?: string[]

  static async purgeMany(userId: string, cond?: any) {
    cond = cond
      ? {
          $and: [cond, { userId }],
        }
      : { userId }

    const rs = await DbItemModel.find(cond).select({
      entry: 1,
    })

    if (rs.length > 0) {
      await DbQuizModel.deleteMany({
        entry: { $in: rs.map((el) => el.entry) },
        type: 'user',
        userId,
      })
    }

    if (!cond) {
      await DbItemModel.updateMany(
        {},
        {
          $pull: { userId },
        }
      )

      await DbItemModel.deleteMany({ userId: { $size: 0 } })
    }
  }
}

export const DbItemModel = getModelForClass(DbItem, {
  schemaOptions: { collection: 'item', timestamps: true },
})
