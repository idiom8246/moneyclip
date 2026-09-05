/** Small exact-decimal operations. BigInts never cross the storage/JSON boundary. */
export function decimal(value: unknown): string | undefined {
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : value
  return typeof text === 'string' && /^[+-]?\d{1,30}(?:\.\d{1,18})?$/.test(text.trim())
    ? text.trim() : undefined
}

function parts(value: string): [bigint, number] {
  const [whole, fraction = ''] = value.split('.')
  return [BigInt(`${whole}${fraction}`), fraction.length]
}

function format(value: bigint, scale: number): string {
  const sign = value < 0n ? '-' : ''
  const digits = (value < 0n ? -value : value).toString().padStart(scale + 1, '0')
  return sign + (scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits)
}

export function decimalSum(values: string[]): string {
  const parsed = values.map(parts)
  const scale = Math.max(0, ...parsed.map(([, s]) => s))
  return format(parsed.reduce((sum, [n, s]) => sum + n * 10n ** BigInt(scale - s), 0n), scale)
}

export function decimalMultiply(a: string, b: string): string {
  const [an, as] = parts(a)
  const [bn, bs] = parts(b)
  return format(an * bn, as + bs)
}

export function decimalNegate(a: string): string {
  const [n, s] = parts(a)
  return format(-n, s)
}

/** Derived ratios have a declared precision; this never changes printed amounts. */
export function decimalDivide(a: string, b: string, precision = 8): string | undefined {
  const [an, as] = parts(a)
  const [bn, bs] = parts(b)
  if (bn === 0n) return undefined
  const numerator = an * 10n ** BigInt(bs + precision)
  const denominator = bn * 10n ** BigInt(as)
  const sign = (numerator < 0n) !== (denominator < 0n) ? -1n : 1n
  const absN = numerator < 0n ? -numerator : numerator
  const absD = denominator < 0n ? -denominator : denominator
  return format(sign * ((absN + absD / 2n) / absD), precision)
}
