import { Plugin } from '@nuxt/types'
import qs from 'query-string'

const onInit: Plugin = ({ $axios }) => {
  // $axios.defaults.validateStatus = (status: number) => {
  //   if (status === 401) {
  //     return true
  //   }

  //   return status >= 200 && status < 300 // default
  // }

  $axios.defaults.paramsSerializer = (params) => {
    return qs.stringify(params, {
      arrayFormat: 'comma',
      encode: false,
      skipNull: true,
      skipEmptyString: true,
    })
  }
}

export default onInit
