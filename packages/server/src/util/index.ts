export function reduceToObj<K extends string, V>(arr: [K, V][]): Record<K, V> {
  return arr.reduce((prev, [k, v]) => ({ ...prev, [k]: v }), {} as any)
}

export function pickObj<K extends string, V>(
  obj: Partial<Record<K, V>>,
  pick: K[]
): Partial<Record<K, V>> {
  return Object.entries(obj).reduce((prev, [k, v]) => {
    if (pick.includes(k as any)) {
      prev[k] = v
    }

    return prev
  }, {} as any)
}
