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

export function reduceToObj<K extends string, V>(arr: [K, V][]): Record<K, V> {
  return arr.reduce((prev, [k, v]) => ({ ...prev, [k]: v }), {} as any)
}

export function pickObj<K extends string, V>(
  obj: Record<K, V>,
  pick: K[]
): Partial<Record<K, V>> {
  return Object.entries(obj).reduce((prev, [k, v]) => {
    if (pick.includes(k as any)) {
      prev[k] = v
    }

    return prev
  }, {} as any)
}

export function arrayize<T>(a: T | T[]): T[] {
  return Array.isArray(a) ? a : [a]
}
