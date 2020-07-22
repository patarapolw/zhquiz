import { Plugin } from '@nuxt/types'
import { URLEncoder } from 'encodeuri-plus'
import rison from 'rison'

const enc = new URLEncoder()

const onInit: Plugin = ({ $axios }) => {
  $axios.defaults.paramsSerializer = (params) => {
    return Object.entries<any>(params)
      .filter(([, v]) => v)
      .map(([k, v]) => {
        if (
          [
            '_',
            'select',
            'type',
            'page',
            'sort',
            'stage',
            'direction',
            'tag',
            'level',
            'lang',
          ].includes(k) ||
          /^is[A-Z]/.test(k)
        ) {
          v = rison.encode(v)
        }

        return `${enc.encode(k, { type: 'queryKey' })}=${enc.encode(v, {
          type: 'queryValue',
        })}`
      })
      .join('&')
  }
}

export default onInit
