export function capitalize(s: string): string {
  if (s.includes(' ')) {
    return s
      .split(' ')
      .map((s0) => capitalize(s0))
      .join(' ')
  }

  return s[0].toLocaleUpperCase() + s.substr(1)
}

export function humanizeDuration(duration: number) {
  if (!duration || typeof duration !== 'number' || duration < 0) {
    return ''
  }

  const stack: (string | null)[] = []

  /**
   * ms
   */
  let div = divideAndRemainder(duration, 1000)
  duration = div.result

  /**
   * s
   */
  div = divideAndRemainder(duration, 60)
  duration = div.result
  stack.push(div.remainder ? `${div.remainder}s` : null)

  /**
   * min
   */
  div = divideAndRemainder(duration, 60)
  duration = div.result
  stack.push(div.remainder ? `${div.remainder}m` : null)

  /**
   * h
   */
  div = divideAndRemainder(duration, 24)
  duration = div.result
  stack.push(div.remainder ? `${div.remainder}h` : null)

  /**
   * d
   */
  div = divideAndRemainder(duration, 7)
  stack.push(div.remainder ? `${div.remainder}d` : null)

  /**
   * w
   */
  const w = div.result % 4
  stack.push(w ? `${w}w` : null)

  /**
   * mo
   */
  const mo = Math.floor(duration / 30) % 12
  stack.push(mo ? `${mo}mo` : null)

  /**
   * y
   */
  const y = Math.floor(duration / 365)
  stack.push(y ? `${y}y` : null)

  let j: number | null = null

  return stack
    .reverse()
    .filter((s, i) => {
      if (j === null && s !== null) {
        j = i
        return true
      }
      if (j !== null && i < j + 2) {
        return true
      }
      return false
    })
    .join(' ')
}

function divideAndRemainder(n: number, by: number) {
  return {
    result: Math.floor(n / by),
    remainder: n % by,
  }
}
