export function sample<T>(arr: T[], size: number): T[] {
  const allN = Array(arr.length)
    .fill(null)
    .map((_, i) => i)
  const outN: number[] = []

  while (allN.length && outN.length < size) {
    outN.push(...allN.splice(Math.floor(Math.random() * allN.length), 1))
  }

  return outN.map((n) => arr[n])
}
