import { Plugin } from '@nuxt/types'
import rison from 'rison'

const onInit: Plugin = ({ $axios }) => {
  // $axios.defaults.validateStatus = (status: number) => {
  //   if (status === 401) {
  //     return true
  //   }

  //   return status >= 200 && status < 300 // default
  // }

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

        return `${encodeURIComponent(k)}=${qsValueEncode(v)}`
      })
      .join('&')
  }
}

export default onInit

function qsValueEncode(s: string) {
  return s
    .split('')
    .map((c) => {
      if (';,/?:+$'.includes(c)) return c
      return encodeURIComponent(c)
    })
    .join('')
}
