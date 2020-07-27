/**
 * @see https://docs.mongodb.com/manual/reference/operator/aggregation/sort/
 */
function getType(m: any): number {
  if (typeof m === 'undefined') {
    return 0
  } else if (typeof m === 'object') {
    if (!m) {
      /**
       * null
       */
      return 2
    } else if (Array.isArray(m)) {
      return 6
    } else if (m instanceof ArrayBuffer) {
      return 7
    } else if (m instanceof Date) {
      return 10
    } else if (m instanceof RegExp) {
      return 12
    }

    return 5
  } else if (typeof m === 'number') {
    return 3
  } else if (typeof m === 'string') {
    return 4
  } else if (typeof m === 'boolean') {
    return 9
  }

  return 3 // Assume number
}

function isUndefinedOrNull(a: any) {
  return !a && (typeof a === 'undefined' || typeof a === 'object')
}

interface IOrderingOptions {
  key: string | ((o: any) => any)
  desc?: boolean
  nullsLast?: boolean
}

/**
 * Comparator function, for use in `Array.prototype.sort`
 */
export function sorter(ord?: IOrderingOptions | IOrderingOptions[]) {
  return (a: any, b: any) => {
    const ords = Array.isArray(ord)
      ? ord
      : [
          ord || {
            key: (o) => o,
          },
        ]

    for (const { key, desc, nullsLast } of ords) {
      const fn = typeof key === 'string' ? (o: any) => o[key] : key

      const m = fn(a)
      const n = fn(b)

      const tA = getType(m)
      const tB = getType(n)

      if (tA === tB) {
        /**
         * Result includes NaN
         */
        let r = m - n

        if (m && typeof m.localeCompare === 'function') {
          r = m.localeCompare(n)
        }

        /**
         * Skip 0, i.e. same type
         * Skip NaN, i.e. uncomparable
         */
        if (!r) {
          continue
        }

        return r * (desc ? -1 : 1)
      } else {
        if (nullsLast) {
          if (isUndefinedOrNull(m)) {
            return -1
          } else if (isUndefinedOrNull(n)) {
            return 1
          }
        }

        return (tA - tB) * (desc ? -1 : 1)
      }
    }

    return 0
  }
}

/**
 * Sorted function just like in Python
 *
 * @example sorted([1, 30, 4, 21, 100000, '3', '5', undefined, null, undefined])
 * //=> [null, 1, 4, 21, 30, 100000, '3', '5', undefined, undefined]
 */
export function sorted<T>(
  arr: Iterable<T>,
  ...args: Parameters<typeof sorter>
): T[] {
  return (Array.isArray(arr) ? arr : Array.from(arr)).sort(sorter(...args))
}
