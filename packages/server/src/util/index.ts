import { Serialize } from 'any-serialize'

export const ser = new Serialize()

export function filterObjValue(obj: any, fn: (v: any) => boolean) {
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.filter((a) => fn(a)).map((a) => filterObjValue(a, fn))
    } else {
      return Object.entries(obj)
        .filter(([, v]) => fn(v))
        .map(([k, v]) => [k, filterObjValue(v, fn)])
        .reduce((prev, [k, v]) => ({ ...prev, [k]: v }), {})
    }
  }

  return obj
}
