import { Plugin } from '@nuxt/types'
import { URLEncoder } from 'encodeuri-plus'
// @ts-ignore
import rison from 'rison-node'

const onInit: Plugin = ({ $axios }) => {
  const enc = new URLEncoder()

  $axios.defaults.paramsSerializer = (query: Record<string, any>) => {
    return Object.entries(query)
      .map(([k, v]) => {
        if (
          [
            'select',
            'sort',
            'type',
            'direction',
            'tag',
            'offset',
            'limit',
            'page',
            'perPage',
            'count',
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
