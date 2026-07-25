/**
 * 字符串工具模块:统一字符串脱敏 / 大小写转换 / 填充 / 截断 / 字节长度
 * 以及通用工具(防抖 / 节流 / 深拷贝)。
 * 迁移自 D6 StringUtils(Java)+ D4 utils(index.ts),纯 TS 实现,零新依赖。
 */

type AnyFn = (...args: any[]) => void // eslint-disable-line @typescript-eslint/no-explicit-any

/** 可取消的防抖/节流函数(调用签名 + cancel)。 */
export interface CancelableFn<T extends AnyFn> {
  (...args: Parameters<T>): void
  cancel(): void
}

/**
 * 字符串脱敏:保留首尾指定数量字符,中间替换为 *。
 * @param str 原始字符串
 * @param startKeep 保留前缀字符数,默认 1
 * @param endKeep 保留后缀字符数,默认 1
 * @returns 脱敏后的字符串;原长度不足以脱敏时原样返回
 * @example hide('13800138000', 3, 4) → '138****8000'
 */
export function hide(str: string, startKeep: number = 1, endKeep: number = 1): string {
  const len = str.length
  if (len <= startKeep + endKeep) return str
  const maskLen = len - startKeep - endKeep
  return str.slice(0, startKeep) + '*'.repeat(maskLen) + str.slice(len - endKeep)
}

/**
 * 驼峰转下划线(小写):支持连续大写(如 HTTPResponse → http_response)。
 * @param str 驼峰字符串
 * @returns 下划线字符串
 * @example toUnderScoreCase('helloWorld') → 'hello_world'
 * @example toUnderScoreCase('HTTPResponse') → 'http_response'
 */
export function toUnderScoreCase(str: string): string {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
}

/**
 * 下划线 / 中划线转驼峰。
 * @param str 源字符串
 * @param capitalizeFirst 是否首字母大写(大驼峰),默认 false
 * @returns 驼峰字符串
 * @example convertToCamelCase('hello_world') → 'helloWorld'
 * @example convertToCamelCase('hello-world', true) → 'HelloWorld'
 */
export function convertToCamelCase(str: string, capitalizeFirst: boolean = false): string {
  const camel = str.replace(/[-_]([a-zA-Z])/g, (_, c: string) => c.toUpperCase())
  if (!capitalizeFirst) return camel
  return camel.charAt(0).toUpperCase() + camel.slice(1)
}

/**
 * 左填充到指定长度。
 * @param str 原始字符串或数字
 * @param length 目标长度
 * @param char 填充字符,默认 '0'
 * @returns 填充后的字符串
 * @example padl('5', 3) → '005'
 * @example padl(123, 6, '*') → '***123'
 */
export function padl(str: string | number, length: number, char: string = '0'): string {
  const s = String(str)
  if (s.length >= length || char.length === 0) return s
  return char.repeat(length - s.length).slice(0, length - s.length) + s
}

/**
 * 右填充到指定长度。
 * @param str 原始字符串或数字
 * @param length 目标长度
 * @param char 填充字符,默认空格
 * @returns 填充后的字符串
 * @example padr('5', 3) → '5  '
 */
export function padr(str: string | number, length: number, char: string = ' '): string {
  const s = String(str)
  if (s.length >= length || char.length === 0) return s
  return s + char.repeat(length - s.length).slice(0, length - s.length)
}

/**
 * 防抖:delay 内多次调用只执行最后一次,返回的函数带 cancel 方法。
 * @param fn 目标函数
 * @param delay 延迟毫秒,默认 300
 * @returns 可取消的防抖函数
 */
export function debounce<T extends AnyFn>(fn: T, delay: number = 300): CancelableFn<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const debounced = ((...args: Parameters<T>) => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      fn(...args)
      timer = null
    }, delay)
  }) as CancelableFn<T>
  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
  return debounced
}

/**
 * 节流:delay 内只执行首次调用,间隔到期补尾调用,返回的函数带 cancel 方法。
 * @param fn 目标函数
 * @param delay 间隔毫秒,默认 300
 * @returns 可取消的节流函数
 */
export function throttle<T extends AnyFn>(fn: T, delay: number = 300): CancelableFn<T> {
  let last = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const throttled = ((...args: Parameters<T>) => {
    const now = Date.now()
    const remaining = delay - (now - last)
    if (remaining <= 0) {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      last = now
      fn(...args)
    } else if (timer === null) {
      timer = setTimeout(() => {
        last = Date.now()
        timer = null
        fn(...args)
      }, remaining)
    }
  }) as CancelableFn<T>
  throttled.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    last = 0
  }
  return throttled
}

/**
 * 深拷贝:支持 Date/RegExp/Map/Set/循环引用;优先 structuredClone,不可用时回退 JSON。
 * @param obj 原始对象
 * @returns 深拷贝结果
 */
export function deepClone<T>(obj: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return structuredClone(obj)
  }
  return JSON.parse(JSON.stringify(obj)) as T
}

/**
 * 字节长度:中文按指定编码计字节,英文 1 字节。
 * @param str 原始字符串
 * @param encoding 编码,utf8(中文 3 字节)或 utf16(中文 2 字节),默认 utf8
 * @returns 字节长度
 * @example byteLength('abc') → 3
 * @example byteLength('你好', 'utf8') → 6
 * @example byteLength('你好', 'utf16') → 4
 */
export function byteLength(str: string, encoding: 'utf8' | 'utf16' = 'utf8'): number {
  if (encoding === 'utf8' && typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length
  }
  let len = 0
  for (const ch of str) {
    len += /[\u4e00-\u9fa5]/.test(ch) ? (encoding === 'utf16' ? 2 : 3) : 1
  }
  return len
}

/**
 * 截断 + 省略号:length 含 suffix 长度。
 * @param str 原始字符串
 * @param length 目标长度(含 suffix)
 * @param suffix 省略符号,默认 '...'
 * @returns 截断后的字符串
 * @example truncate('Hello World', 8) → 'Hello...'
 */
export function truncate(str: string, length: number, suffix: string = '...'): string {
  if (str.length <= length) return str
  const cut = length - suffix.length
  return cut <= 0 ? suffix.slice(0, length) : str.slice(0, cut) + suffix
}

/**
 * 首字母大写,其余字符不变。
 * @param str 原始字符串
 * @returns 首字母大写的字符串
 * @example capitalize('hello') → 'Hello'
 */
export function capitalize(str: string): string {
  if (str.length === 0) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * 空值检查:null/undefined/空字符串/纯空格 → true。
 * @param str 待检查字符串
 * @returns 是否为空白
 * @example isBlank('  ') → true
 * @example isBlank('a') → false
 */
export function isBlank(str: string | null | undefined): boolean {
  if (str === null || str === undefined) return true
  return str.trim().length === 0
}

/**
 * 生成随机字符串(非密码学安全)。
 * @param length 长度,默认 8
 * @param charset 字符集,默认大小写字母 + 数字
 * @returns 随机字符串
 * @example randomString(8) → 'aB3xK9mN'
 */
export function randomString(length: number = 8, charset?: string): string {
  const chars = charset ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  if (chars.length === 0) return ''
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
