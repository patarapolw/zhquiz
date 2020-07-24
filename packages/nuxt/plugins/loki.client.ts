import { Plugin } from '@nuxt/types'

const onInit: Plugin = ({ app }) => {
  app.$accessor.dictionary.init()
}

export default onInit
