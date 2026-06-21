/**
 * 随机数生成工具函数
 * 提供随机数、随机字符串、UUID生成等功能
 */

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomFloat(min: number, max: number, decimals: number = 2): number {
  const value = Math.random() * (max - min) + min
  return parseFloat(value.toFixed(decimals))
}

export function randomBoolean(): boolean {
  return Math.random() >= 0.5
}

export function randomElement<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined
  return arr[Math.floor(Math.random() * arr.length)]
}

export function randomElements<T>(arr: T[], count: number): T[] {
  const result: T[] = []
  const copy = [...arr]

  for (let i = 0; i < Math.min(count, arr.length); i++) {
    const index = Math.floor(Math.random() * copy.length)
    result.push(copy.splice(index, 1)[0])
  }

  return result
}

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function randomString(length: number, charset?: string): string {
  const defaultCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const chars = charset || defaultCharset

  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function randomNumericString(length: number): string {
  return randomString(length, '0123456789')
}

export function randomAlphaString(length: number, uppercase: boolean = false): string {
  const charset = uppercase ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : 'abcdefghijklmnopqrstuvwxyz'
  return randomString(length, charset)
}

export function randomAlphanumeric(length: number): string {
  return randomString(length)
}

export function randomHex(length: number): string {
  return randomString(length, '0123456789abcdef')
}

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function uuidShort(): string {
  return uuid().replace(/-/g, '').slice(0, 8)
}

export function nanoid(length: number = 21): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
  return randomString(length, charset)
}

export function randomColor(): string {
  return `#${randomHex(6)}`
}

export function randomRgb(): string {
  const r = randomInt(0, 255)
  const g = randomInt(0, 255)
  const b = randomInt(0, 255)
  return `rgb(${r}, ${g}, ${b})`
}

export function randomRgba(alpha: number = 1): string {
  const r = randomInt(0, 255)
  const g = randomInt(0, 255)
  const b = randomInt(0, 255)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function randomHsl(): string {
  const h = randomInt(0, 360)
  const s = randomInt(0, 100)
  const l = randomInt(0, 100)
  return `hsl(${h}, ${s}%, ${l}%)`
}

export function randomDate(start: Date, end: Date): Date {
  const startTime = start.getTime()
  const endTime = end.getTime()
  const randomTime = startTime + Math.random() * (endTime - startTime)
  return new Date(randomTime)
}

export function randomTimestamp(start?: number, end?: number): number {
  const startTime = start ?? Date.now() - 365 * 24 * 60 * 60 * 1000
  const endTime = end ?? Date.now()
  return startTime + Math.random() * (endTime - startTime)
}

export function randomIp(): string {
  return `${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}`
}

export function randomMac(): string {
  const hex = () => randomHex(2).toUpperCase()
  return `${hex()}:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}`
}

export function randomPort(): number {
  return randomInt(1024, 65535)
}

export function randomUrl(protocol: string = 'https'): string {
  const domain = randomString(randomInt(5, 10), 'abcdefghijklmnopqrstuvwxyz')
  const tld = randomElement(['com', 'org', 'net', 'io', 'dev']) || 'com'
  return `${protocol}://${domain}.${tld}`
}

export function randomEmail(domain?: string): string {
  const username = randomString(randomInt(5, 10), 'abcdefghijklmnopqrstuvwxyz0123456789')
  const emailDomain = domain || `${randomString(randomInt(5, 8), 'abcdefghijklmnopqrstuvwxyz')}.${randomElement(['com', 'org', 'net']) || 'com'}`
  return `${username}@${emailDomain}`
}

export function randomPhone(): string {
  const prefix = randomElement(['138', '139', '150', '151', '152', '158', '159', '186', '187', '188']) || '138'
  return prefix + randomNumericString(8)
}

export function weightedRandom<T>(items: T[], weights: number[]): T | undefined {
  if (items.length === 0 || items.length !== weights.length) return undefined

  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  let random = Math.random() * totalWeight

  for (let i = 0; i < items.length; i++) {
    random -= weights[i]
    if (random <= 0) {
      return items[i]
    }
  }

  return items[items.length - 1]
}

export function randomRange(count: number, min: number, max: number, unique: boolean = false): number[] {
  if (unique && max - min + 1 < count) {
    throw new Error('Range is too small for unique values')
  }

  if (unique) {
    const values = new Set<number>()
    while (values.size < count) {
      values.add(randomInt(min, max))
    }
    return Array.from(values)
  }

  return Array.from({ length: count }, () => randomInt(min, max))
}

export function useRandom() {
  return {
    randomInt,
    randomFloat,
    randomBoolean,
    randomElement,
    randomElements,
    shuffle,
    randomString,
    randomNumericString,
    randomAlphaString,
    randomAlphanumeric,
    randomHex,
    uuid,
    uuidShort,
    nanoid,
    randomColor,
    randomRgb,
    randomRgba,
    randomHsl,
    randomDate,
    randomTimestamp,
    randomIp,
    randomMac,
    randomPort,
    randomUrl,
    randomEmail,
    randomPhone,
    weightedRandom,
    randomRange,
  }
}

export default {
  randomInt,
  randomFloat,
  randomBoolean,
  randomElement,
  randomElements,
  shuffle,
  randomString,
  randomNumericString,
  randomAlphaString,
  randomAlphanumeric,
  randomHex,
  uuid,
  uuidShort,
  nanoid,
  randomColor,
  randomRgb,
  randomRgba,
  randomHsl,
  randomDate,
  randomTimestamp,
  randomIp,
  randomMac,
  randomPort,
  randomUrl,
  randomEmail,
  randomPhone,
  weightedRandom,
  randomRange,
}
