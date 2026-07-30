/**
 * 移动端/小程序端通用格式工具(2026-07-30 立)
 *
 * 设计目标:消除 apps/mobile-rn 与 apps/miniapp-taro 各登录/注册/资料页面
 * 中重复出现的"手机号/邮箱/密码"校验、格式化、脱敏逻辑。
 *
 * 平台无关:纯函数 + 纯正则,无任何平台依赖。
 *
 * 与 format.ts(已存在)的关系:
 * - format.ts:数字/货币/相对时间等通用格式化
 * - format-mobile.ts:手机/邮箱/密码/验证码等移动端业务校验 + 展示
 */

/** 中国大陆手机号正则(13/14/15/16/17/18/19 开头 + 9 位数字) */
export const CN_PHONE_REGEX = /^1[3-9]\d{9}$/

/** 简单邮箱正则(覆盖 99% 真实场景,严格 RFC 不在本工具范围内) */
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

/**
 * 校验中国大陆手机号
 *
 * @example
 * isValidPhone('13812345678') // true
 * isValidPhone('1381234567')  // false
 * isValidPhone('+86 138 1234 5678') // false(包含非数字字符)
 * isValidPhone('')            // false
 * isValidPhone(null)          // false
 */
export function isValidPhone(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  return CN_PHONE_REGEX.test(trimmed)
}

/**
 * 校验邮箱
 */
export function isValidEmail(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  return EMAIL_REGEX.test(trimmed)
}

/**
 * 校验密码强度
 *
 * 默认规则:6-20 位,至少含字母和数字(支持中文等 Unicode 字符)
 * 自定义可通过 opts 覆盖。
 */
export interface PasswordOptions {
  minLength?: number
  maxLength?: number
  /** 是否必须含字母 */
  requireLetter?: boolean
  /** 是否必须含数字 */
  requireDigit?: boolean
}

export function isValidPassword(value: unknown, opts: PasswordOptions = {}): boolean {
  const { minLength = 6, maxLength = 20, requireLetter = true, requireDigit = true } = opts
  if (typeof value !== 'string') return false
  if (value.length < minLength || value.length > maxLength) return false
  // 支持 Unicode 字母(中文/日文/韩文/拉丁扩展等),用 \p{L} 替代 a-zA-Z
  if (requireLetter && !/\p{L}/u.test(value)) return false
  if (requireDigit && !/\d/.test(value)) return false
  return true
}

/**
 * 校验短信验证码(6 位数字)
 */
export function isValidSmsCode(value: unknown, length = 6): boolean {
  if (typeof value !== 'string') return false
  const re = new RegExp(`^\\d{${length}}$`)
  return re.test(value.trim())
}

/**
 * 手机号脱敏(完整格式)
 *
 * @example
 * maskPhone('13812345678') // '138****5678'
 * maskPhone('13812')       // '138**'
 */
export function maskPhone(phone: string): string {
  if (typeof phone !== 'string') return ''
  if (phone.length < 7) {
    if (phone.length <= 3) return phone
    return phone.slice(0, 3) + '*'.repeat(phone.length - 3)
  }
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

/**
 * 邮箱脱敏
 *
 * @example
 * maskEmail('alice@example.com')  // 'al****@example.com'
 * maskEmail('a@example.com')      // 'a****@example.com'
 * maskEmail('invalid')            // '****'
 */
export function maskEmail(email: string): string {
  if (typeof email !== 'string' || !email.includes('@')) return '****'
  const [name, domain] = email.split('@')
  if (!name || !domain) return '****'
  if (name.length <= 2) return name[0] + '****@' + domain
  return name.slice(0, 2) + '****@' + domain
}

/**
 * 格式化手机号展示(添加空格分隔)
 *
 * @example
 * formatPhoneDisplay('13812345678')         // '138 1234 5678'
 * formatPhoneDisplay('13812345678', '-')    // '138-1234-5678'
 * formatPhoneDisplay('+86 13812345678', ' ') // '+86 138 1234 5678'(区号保留)
 */
export function formatPhoneDisplay(phone: string, separator = ' '): string {
  if (typeof phone !== 'string') return ''
  const trimmed = phone.trim()
  if (!trimmed) return ''

  // 处理 +86 / +1 + 11 位中国手机号(优先匹配,避免贪婪匹配吞掉手机号)
  const cnIntlMatch = /^(\+\d{1,3})(\d{11})$/.exec(trimmed)
  if (cnIntlMatch) {
    const prefix = cnIntlMatch[1]
    const rest = cnIntlMatch[2] ?? ''
    if (!prefix || !rest) return trimmed
    return `${prefix} ${formatPhoneDisplay(rest, separator)}`
  }

  // 处理 +1 + 10 位美国/加拿大号码
  const usIntlMatch = /^(\+\d{1,3})(\d{10})$/.exec(trimmed)
  if (usIntlMatch) {
    const prefix = usIntlMatch[1]
    const rest = usIntlMatch[2] ?? ''
    if (!prefix || !rest) return trimmed
    return `${prefix} ${formatPhoneDisplay(rest, separator)}`
  }

  // 11 位中国大陆手机号
  if (CN_PHONE_REGEX.test(trimmed)) {
    return `${trimmed.slice(0, 3)}${separator}${trimmed.slice(3, 7)}${separator}${trimmed.slice(7)}`
  }

  // 8 位座机(区号-号码)
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}${separator}${trimmed.slice(4)}`
  }

  // 7 位座机(区号-号码)
  if (/^\d{7}$/.test(trimmed)) {
    return `${trimmed.slice(0, 3)}${separator}${trimmed.slice(3)}`
  }

  return trimmed
}

/**
 * 提取手机号纯数字(去除空格/横线/+86 等)
 *
 * @example
 * extractPhoneDigits('138 1234 5678')        // '13812345678'
 * extractPhoneDigits('+86 138-1234-5678')    // '13812345678'
 */
export function extractPhoneDigits(input: string): string {
  if (typeof input !== 'string') return ''
  // 去除国际区号前缀
  const withoutIntl = input.replace(/^\+\d{1,3}\s*/, '')
  return withoutIntl.replace(/\D/g, '')
}

/**
 * 生成 N 位数字验证码
 *
 * 用于前端倒计时前的随机数(默认 6 位)。
 * 注意:不用于实际生产 SMS 验证码生成,仅用于 mock / 测试场景。
 */
export function generateSmsCode(length = 6): string {
  if (length <= 0) return ''
  let code = ''
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString()
  }
  return code
}

/**
 * 隐藏中间字符(用于身份证/银行卡等敏感信息)
 *
 * @param value 待脱敏字符串
 * @param head  头部保留字符数(默认 3)
 * @param tail  尾部保留字符数(默认 4)
 *
 * @example
 * maskMiddle('110101199001011234', 4, 4) // '1101********1234'
 * maskMiddle('6222021234567890', 4, 4)   // '6222********7890'
 */
export function maskMiddle(value: string, head = 3, tail = 4): string {
  if (typeof value !== 'string') return ''
  if (value.length <= head + tail) return '*'.repeat(value.length)
  const headPart = value.slice(0, head)
  const tailPart = value.slice(value.length - tail)
  const middle = '*'.repeat(value.length - head - tail)
  return `${headPart}${middle}${tailPart}`
}
