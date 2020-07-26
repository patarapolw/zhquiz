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

/**
 * TODO: move date object from client side to server
 * @deprecated
 */
export function restoreDate(obj: any): any {
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.map((a) => restoreDate(a))
    } else if (obj.$toDate) {
      return new Date(obj.$toDate)
    } else {
      return Object.entries(obj)
        .map(([k, v]) => [k, restoreDate(v)])
        .reduce((prev, [k, v]) => ({ ...prev, [k]: v }), {})
    }
  }

  return obj
}
