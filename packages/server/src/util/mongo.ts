import mongoose from 'mongoose'

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

export const sharedUserIds = ['shared', 'default']

// export function getAuthorizedCategories({
//   userId,
//   type,
//   categoryId,
// }: {
//   userId: string
//   type?: typeof sDictionaryType.type | 'user' | typeof sDictionaryType.type[]
//   categoryId?: string
// }) {
//   return DbCategoryModel.find({
//     _id: categoryId,
//     userId: {
//       $in: [userId, 'shared', 'default'],
//     },
//     type: type
//       ? type === 'user'
//         ? { $exists: false }
//         : Array.isArray(type)
//         ? { $in: type }
//         : type
//       : undefined,
//   })
// }
