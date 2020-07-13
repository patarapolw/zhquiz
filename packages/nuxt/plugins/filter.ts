import dayjs from 'dayjs'
import Vue from 'vue'

import { humanizeDuration } from '~/assets/humanize-duration'

Vue.filter('format', (v: any) => {
  if (typeof v === 'number') {
    return v || v === 0 ? v.toLocaleString() : ''
  } else if (v instanceof Date) {
    return dayjs(v).format('YYYY-MM-DD HH:mm')
  } else if (v && typeof v === 'object') {
    return JSON.stringify(v)
  }
  return v
})

Vue.filter('formatDate', (v: any) => {
  return dayjs(v).format('YYYY-MM-DD HH:mm')
})

Vue.filter('duration', (v: any) => {
  return v ? humanizeDuration(+new Date(v) - +new Date()) : ''
})
