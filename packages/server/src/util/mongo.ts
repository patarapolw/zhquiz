import mongoose from 'mongoose'

import { DbCategoryModel } from '@/db/mongo'

import { sDictionaryType, sLang, sTranslation } from './schema'

export async function mongoInit() {
  return await mongoose.connect(process.env.MONGO_URI!, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })
}

export function safeString(s?: string) {
  if (!s) {
    return { $exists: false }
  }

  if (s.startsWith('$')) {
    return { $literal: s }
  }

  return s
}

export function getAuthorizedCategories({
  userId,
  type,
  lang,
  translation,
  categoryId,
}: {
  userId: string
  type?: typeof sDictionaryType.type | 'user' | typeof sDictionaryType.type[]
  lang?: typeof sLang.type
  translation?: typeof sTranslation.type
  categoryId?: string
}) {
  return DbCategoryModel.find({
    _id: categoryId,
    userId: {
      $in: [userId, 'shared', 'default'],
    },
    type: type
      ? type === 'user'
        ? { $exists: false }
        : Array.isArray(type)
        ? { $in: type }
        : type
      : undefined,
    lang,
    translation,
  })
}
