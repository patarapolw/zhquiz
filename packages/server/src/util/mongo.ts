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

// export const sharedUserIds = ['shared', 'default']
