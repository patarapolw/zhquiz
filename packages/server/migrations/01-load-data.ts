import { mongoInit } from '@/util/mongo'

import { loadChineseDictionaries } from './load-from-local/dictionary'
import { loadChineseTemplate } from './load-from-local/template'

if (require.main === module) {
  ;(async () => {
    const mongoose = await mongoInit()
    await loadChineseTemplate()
    await loadChineseDictionaries()
    await mongoose.disconnect()
  })()
}
