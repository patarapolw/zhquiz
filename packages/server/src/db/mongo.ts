import {
  getModelForClass,
  index,
  prop,
  setGlobalOptions,
  Severity,
} from '@typegoose/typegoose'
import S from 'jsonschema-definer'
import { Schema } from 'mongoose'
import { nanoid } from 'nanoid'
import XRegExp from 'xregexp'

import { safeString } from '@/util/mongo'
import {
  sDateTime,
  sDictionaryType,
  sId,
  sLang,
  sTranslation,
} from '@/util/schema'

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
  @prop({ default: () => nanoid() }) _id!: string
  @prop({ required: true, unique: true }) email!: string
  @prop() name!: string
  @prop({ default: 1 }) levelMin?: number
  @prop({ default: 60 }) levelMax?: number
  @prop({ default: 'chinese' }) lang?: typeof sLang.type
  @prop({ default: 'english' }) translation?: typeof sTranslation.type
  @prop({
    validate: (s) => typeof s === 'undefined' || !sUserSettings.validate(s)[1],
  })
  settings?: typeof sUserSettings.type

  static async signIn(email: string, name: string) {
    let user = await DbUserModel.findOne({ email: safeString(email) })
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
    await DbCategoryModel.purgeMany(userId)
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
  lastRight: sDateTime.optional(),
  lastWrong: sDateTime.optional(),
})

export const sDbQuizExportSelect = S.string().enum(
  '_id',
  'direction',
  'front',
  'back',
  'mnemonic',
  'srsLevel',
  'stat'
)

export const sDbQuizExportPartial = S.shape({
  _id: S.string().optional(),
  direction: S.string().optional(),
  front: S.string().optional(),
  back: S.string().optional(),
  mnemonic: S.string().optional(),
  srsLevel: S.integer().optional(),
  stat: sQuizStat.optional(),
})

type IDbQuizExportPartial = typeof sDbQuizExportPartial.type

@index({ userId: 1, templateId: 1, entry: 1, direction: 1 }, { unique: true })
export class DbQuiz implements IDbQuizExportPartial {
  @prop({ default: () => nanoid() }) _id!: string
  @prop({ required: true }) userId!: string
  @prop({ required: true }) templateId!: string
  @prop({ required: true }) entry!: string
  @prop() front?: string
  @prop() back?: string
  @prop() mnemonic?: string
  @prop({
    type: Schema.Types.Mixed,
    validate: (s: string[] = []) => s.every((s0) => typeof s0 === 'string'),
  })
  tag?: string[]

  @prop() nextReview?: Date
  @prop() srsLevel?: number
  @prop({
    validate: (s) => typeof s === 'undefined' || !sQuizStat.validate(s)[1],
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

/**
 * Sharable
 */

export const sDbCategoryExportSelect = S.string().enum('type')

export const sDbCategoryExportPartial = S.shape({
  type: sDictionaryType.optional(),
})

type IDbCategoryExportPartial = typeof sDbCategoryExportPartial.type

@index({ name: 1, lang: 1, translation: 1, type: 1 }, { unique: true })
export class DbCategory implements IDbCategoryExportPartial {
  @prop({ default: () => nanoid() }) _id!: string
  @prop({
    required: true,
    type: Schema.Types.Mixed,
    validate: (s: string[] = []) => s.every((s0) => typeof s0 === 'string'),
  })
  userId!: string[]

  @prop({ required: true }) name!: string
  @prop({ required: true }) lang!: typeof sLang.type
  @prop({ required: true }) translation!: typeof sTranslation.type
  @prop({
    validate: (s) =>
      typeof s !== 'undefined' && !sDictionaryType.validate(s)[1],
  })
  type?: typeof sDictionaryType.type

  @prop() priority?: number

  @prop({
    type: Schema.Types.Mixed,
    validate: (s: string[] = []) => s.every((s0) => typeof s0 === 'string'),
  })
  tag?: string[]

  static async purgeMany(userId: string, cond?: any) {
    cond = cond
      ? {
          $and: [cond, { userId }],
        }
      : { userId }

    const rs = await DbCategoryModel.aggregate([
      { $match: cond },
      {
        $lookup: {
          from: 'template',
          localField: '_id',
          foreignField: 'categoryId',
          as: 't',
        },
      },
      { $unwind: '$t' },
      {
        $project: {
          _id: 1,
          templateId: '$t._id',
        },
      },
    ])
    console.log(rs)

    const tids = [
      ...new Set<string>(rs.map((r) => r.templateId).filter((id) => id)),
    ]

    const cids = [...new Set<string>(rs.map((r) => r._id).filter((id) => id))]

    const promises: Promise<any>[] = []

    if (tids.length > 0) {
      promises.push(
        DbQuizModel.deleteMany({
          userId,
          templateId: { $in: tids },
        }).exec()
      )
    }

    if (cids.length > 0) {
      promises.push(
        DbTemplateModel.deleteMany({
          categoryId: { $in: cids },
        }).exec(),
        DbItemModel.deleteMany({
          categoryId: { $in: cids },
        }).exec(),
        (async () => {
          await DbCategoryModel.updateMany(
            {
              _id: { $in: cids },
              userId,
            },
            {
              $pull: { userId },
            }
          )

          await DbCategoryModel.deleteMany({ userId: { $size: 0 } })
        })()
      )
    }

    await Promise.all(promises)
  }
}

export const DbCategoryModel = getModelForClass(DbCategory, {
  schemaOptions: { collection: 'category', timestamps: true },
})

export const sDbTemplateExportSelect = S.string().enum(
  '_id',
  'categoryId',
  'direction',
  'requiredFields',
  'front',
  'back'
)

export const sDbTemplateExportPartial = S.shape({
  _id: sId.optional(),
  categoryId: sId.optional(),
  direction: S.string().optional(),
  requiredFields: S.list(S.string()).optional(),
  front: S.string().optional(),
  back: S.string().optional(),
})

type IDbTemplateExportPartial = typeof sDbTemplateExportPartial.type

@index({ categoryId: 1, direction: 1 }, { unique: true })
export class DbTemplate implements IDbTemplateExportPartial {
  @prop({ default: () => nanoid() }) _id!: string
  @prop({ required: true }) categoryId!: string
  @prop({ required: true }) direction!: string
  @prop({
    type: Schema.Types.Mixed,
    validate: (s: string[] = []) => s.every((s0) => typeof s0 === 'string'),
  })
  requiredFields?: string[]

  @prop({ required: true }) front!: string
  @prop() back?: string
}

export const DbTemplateModel = getModelForClass(DbTemplate, {
  schemaOptions: { collection: 'template', timestamps: true },
})

export const sDbItemExportSelect = S.string().enum(
  '_id',
  'entry',
  'alt',
  'reading',
  'translation',
  'updatedAt'
)

export const sDbItemExportPartial = S.shape({
  _id: sId.optional(),
  entry: S.string().optional(),
  alt: S.list(S.string()).minItems(1).optional(),
  reading: S.list(S.string()).minItems(1).optional(),
  translation: S.list(S.string()).minItems(1).optional(),
  updatedAt: sDateTime.optional(),
})

type IDbItemExportPartial = typeof sDbItemExportPartial.type

export const sDbItem = S.shape({
  categoryId: S.string(),
  entry: S.string(),
  alt: S.list(S.string()).optional(),
  reading: S.list(S.string()).optional(),
  translation: S.list(S.string()).optional(),
  level: S.integer().minimum(1).maximum(60).optional(),
  tag: S.list(S.string()).optional(),
  priority: S.number().optional(),
  frequency: S.number().optional(),
})

type IDbItem = typeof sDbItem.type

@index({ categoryId: 1, entry: 1 }, { unique: true })
class DbItem implements IDbItem, IDbItemExportPartial {
  @prop({ default: () => nanoid() }) _id?: string
  @prop({ required: true }) categoryId!: string
  @prop({ required: true, text: true }) entry!: string
  @prop({
    type: Schema.Types.Mixed,
    validate: (s: string[] = []) => s.every((s0) => typeof s0 === 'string'),
    text: true,
  })
  alt?: string[]

  @prop({
    type: Schema.Types.Mixed,
    validate: (s: string[] = []) => s.every((s0) => typeof s0 === 'string'),
  })
  reading?: string[]

  @prop({
    type: Schema.Types.Mixed,
    validate: (s: string[] = []) => s.every((s0) => typeof s0 === 'string'),
  })
  translation?: string[]

  @prop() level?: number
  @prop({
    type: Schema.Types.Mixed,
    validate: (s: string[] = []) => s.every((s0) => typeof s0 === 'string'),
  })
  tag?: string[]

  @prop() priority?: number
  @prop() frequency?: number
}

export const DbItemModel = getModelForClass(DbItem, {
  schemaOptions: { collection: 'item', timestamps: true },
})

/**
 * Immutable
 */

export const sToken = S.string().pattern(XRegExp('^\\p{Han}$'))
export const sTokenArray = S.list(sToken).minItems(1).uniqueItems(true)

export const sDbToken = S.shape({
  _id: sToken,
  sub: sTokenArray.optional(),
  sup: sTokenArray.optional(),
  variants: sTokenArray.optional(),
})

type IDbToken = typeof sDbToken.type

class DbToken implements IDbToken {
  @prop() _id!: typeof sToken.type
  @prop() sub?: typeof sTokenArray.type
  @prop() sup?: typeof sTokenArray.type
  @prop() variants?: typeof sTokenArray.type

  get entry() {
    return this._id
  }
}

export const DbTokenModel = getModelForClass(DbToken, {
  schemaOptions: { collection: 'token' },
})
