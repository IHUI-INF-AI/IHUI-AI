/**
 * 移动端/小程序端格式工具测试(2026-07-30 立)
 *
 * 覆盖范围:
 * 1. isValidPhone:大陆 11 位手机号校验
 * 2. isValidEmail:邮箱格式校验
 * 3. isValidPassword:密码强度校验
 * 4. isValidSmsCode:6 位数字验证码校验
 * 5. maskPhone / maskEmail:脱敏
 * 6. formatPhoneDisplay:手机号展示格式化
 * 7. extractPhoneDigits:提取纯数字
 * 8. generateSmsCode:N 位数字生成
 * 9. maskMiddle:中间字符脱敏
 */
import { describe, it, expect } from 'vitest'
import {
  isValidPhone,
  isValidEmail,
  isValidPassword,
  isValidSmsCode,
  maskPhone,
  maskEmail,
  formatPhoneDisplay,
  extractPhoneDigits,
  generateSmsCode,
  maskMiddle,
  CN_PHONE_REGEX,
  EMAIL_REGEX,
} from '../../src/utils/format-mobile'

describe('isValidPhone', () => {
  it('合法大陆手机号', () => {
    expect(isValidPhone('13812345678')).toBe(true)
    expect(isValidPhone('15812345678')).toBe(true)
    expect(isValidPhone('18812345678')).toBe(true)
    expect(isValidPhone('19912345678')).toBe(true)
  })

  it('不合法(位数不对)', () => {
    expect(isValidPhone('1381234567')).toBe(false) // 10 位
    expect(isValidPhone('138123456789')).toBe(false) // 12 位
  })

  it('不合法(开头非 13-19)', () => {
    expect(isValidPhone('10812345678')).toBe(false)
    expect(isValidPhone('12812345678')).toBe(false)
    expect(isValidPhone('20812345678')).toBe(false)
  })

  it('不合法(含非数字字符)', () => {
    expect(isValidPhone('+86 138 1234 5678')).toBe(false)
    expect(isValidPhone('138-1234-5678')).toBe(false)
    expect(isValidPhone('138 1234 5678')).toBe(false)
  })

  it('空/null/undefined/非字符串', () => {
    expect(isValidPhone('')).toBe(false)
    expect(isValidPhone(null)).toBe(false)
    expect(isValidPhone(undefined)).toBe(false)
    expect(isValidPhone(13812345678)).toBe(false) // 数字
    expect(isValidPhone({})).toBe(false)
  })

  it('前后空格被 trim 后校验', () => {
    expect(isValidPhone('  13812345678  ')).toBe(true)
  })

  it('CN_PHONE_REGEX 导出常量可独立使用', () => {
    expect(CN_PHONE_REGEX.test('13812345678')).toBe(true)
    expect(CN_PHONE_REGEX.test('123')).toBe(false)
  })
})

describe('isValidEmail', () => {
  it('合法邮箱', () => {
    expect(isValidEmail('alice@example.com')).toBe(true)
    expect(isValidEmail('a.b+c@sub.example.co.uk')).toBe(true)
    expect(isValidEmail('user_name@example-domain.com')).toBe(true)
  })

  it('不合法(无 @)', () => {
    expect(isValidEmail('alice.example.com')).toBe(false)
  })

  it('不合法(无 domain)', () => {
    expect(isValidEmail('alice@')).toBe(false)
    expect(isValidEmail('alice@example')).toBe(false)
  })

  it('不合法(无 username)', () => {
    expect(isValidEmail('@example.com')).toBe(false)
  })

  it('空/null', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail(null)).toBe(false)
    expect(isValidEmail(undefined)).toBe(false)
  })

  it('前后空格被 trim', () => {
    expect(isValidEmail('  alice@example.com  ')).toBe(true)
  })

  it('EMAIL_REGEX 导出常量', () => {
    expect(EMAIL_REGEX.test('alice@example.com')).toBe(true)
    expect(EMAIL_REGEX.test('not-email')).toBe(false)
  })
})

describe('isValidPassword', () => {
  it('默认规则(6-20 位 + 字母 + 数字)', () => {
    expect(isValidPassword('abc123')).toBe(true)
    expect(isValidPassword('Aa123456')).toBe(true)
    expect(isValidPassword('1a')).toBe(false) // 太短
    expect(isValidPassword('123456')).toBe(false) // 无字母
    expect(isValidPassword('abcdef')).toBe(false) // 无数字
  })

  it('自定义 minLength/maxLength', () => {
    expect(isValidPassword('abc12', { minLength: 5, maxLength: 10 })).toBe(true)
    expect(isValidPassword('abc12', { minLength: 6, maxLength: 10 })).toBe(false)
  })

  it('关闭 requireLetter', () => {
    expect(isValidPassword('123456', { requireLetter: false })).toBe(true)
  })

  it('关闭 requireDigit', () => {
    expect(isValidPassword('abcdef', { requireDigit: false })).toBe(true)
  })

  it('非字符串返回 false', () => {
    expect(isValidPassword(123456)).toBe(false)
    expect(isValidPassword(null)).toBe(false)
  })

  it('超长密码拒绝', () => {
    expect(isValidPassword('a'.repeat(21))).toBe(false)
  })

  it('密码含中文 + 数字也合法(Unicode)', () => {
    expect(isValidPassword('密码1234')).toBe(true) // 6 字符 = 2 中文 + 4 数字
    expect(isValidPassword('a密码1234')).toBe(true) // 7 字符
  })
})

describe('isValidSmsCode', () => {
  it('6 位数字', () => {
    expect(isValidSmsCode('123456')).toBe(true)
    expect(isValidSmsCode('000000')).toBe(true)
  })

  it('5 位/7 位拒绝', () => {
    expect(isValidSmsCode('12345')).toBe(false)
    expect(isValidSmsCode('1234567')).toBe(false)
  })

  it('含非数字拒绝', () => {
    expect(isValidSmsCode('12345a')).toBe(false)
    expect(isValidSmsCode('abcdef')).toBe(false)
  })

  it('自定义 length', () => {
    expect(isValidSmsCode('1234', 4)).toBe(true)
    expect(isValidSmsCode('12345', 4)).toBe(false)
  })

  it('空/null 拒绝', () => {
    expect(isValidSmsCode('')).toBe(false)
    expect(isValidSmsCode(null)).toBe(false)
  })

  it('前后空格被 trim', () => {
    expect(isValidSmsCode('  123456  ')).toBe(true)
  })
})

describe('maskPhone', () => {
  it('完整 11 位手机号 → 中间 4 位 ****', () => {
    expect(maskPhone('13812345678')).toBe('138****5678')
  })

  it('非 11 位但 ≥7:截断处理(4 个 *)', () => {
    expect(maskPhone('1381234567')).toBe('138****4567')
  })

  it('长度 ≤ 3:全部保留(避免 *** 太短)', () => {
    expect(maskPhone('138')).toBe('138')
  })

  it('空/非字符串', () => {
    expect(maskPhone('')).toBe('')
    expect(maskPhone(null as unknown as string)).toBe('')
  })
})

describe('maskEmail', () => {
  it('完整邮箱 → 保留前 2 位', () => {
    expect(maskEmail('alice@example.com')).toBe('al****@example.com')
  })

  it('短 username(2 位):保留 1 位', () => {
    expect(maskEmail('ab@example.com')).toBe('a****@example.com')
  })

  it('1 位 username', () => {
    expect(maskEmail('a@example.com')).toBe('a****@example.com')
  })

  it('无 @ 返回 ****', () => {
    expect(maskEmail('invalid')).toBe('****')
  })

  it('@ 前后为空时返回 ****', () => {
    expect(maskEmail('@example.com')).toBe('****')
    expect(maskEmail('alice@')).toBe('****')
  })
})

describe('formatPhoneDisplay', () => {
  it('11 位手机号 → 138 1234 5678', () => {
    expect(formatPhoneDisplay('13812345678')).toBe('138 1234 5678')
  })

  it('11 位手机号 + 自定义分隔符', () => {
    expect(formatPhoneDisplay('13812345678', '-')).toBe('138-1234-5678')
  })

  it('国际区号 +86', () => {
    expect(formatPhoneDisplay('+8613812345678')).toBe('+86 138 1234 5678')
  })

  it('8 位座机 → 1234 5678(默认空格)', () => {
    expect(formatPhoneDisplay('12345678')).toBe('1234 5678')
  })

  it('8 位座机 → 1234-5678(自定义 -)', () => {
    expect(formatPhoneDisplay('12345678', '-')).toBe('1234-5678')
  })

  it('7 位座机 → 123-4567(自定义 -)', () => {
    expect(formatPhoneDisplay('1234567', '-')).toBe('123-4567')
  })

  it('空字符串 → 空', () => {
    expect(formatPhoneDisplay('')).toBe('')
  })

  it('非 11/7/8 位数字 → 原样返回', () => {
    expect(formatPhoneDisplay('12345')).toBe('12345')
  })

  it('非字符串 → 空', () => {
    expect(formatPhoneDisplay(null as unknown as string)).toBe('')
  })
})

describe('extractPhoneDigits', () => {
  it('空格分隔的手机号 → 纯数字', () => {
    expect(extractPhoneDigits('138 1234 5678')).toBe('13812345678')
  })

  it('横线分隔', () => {
    expect(extractPhoneDigits('138-1234-5678')).toBe('13812345678')
  })

  it('国际区号 +86', () => {
    expect(extractPhoneDigits('+86 138 1234 5678')).toBe('13812345678')
  })

  it('已为纯数字 → 原样', () => {
    expect(extractPhoneDigits('13812345678')).toBe('13812345678')
  })

  it('空字符串 → 空', () => {
    expect(extractPhoneDigits('')).toBe('')
  })

  it('非字符串 → 空', () => {
    expect(extractPhoneDigits(null as unknown as string)).toBe('')
  })
})

describe('generateSmsCode', () => {
  it('默认 6 位数字', () => {
    const code = generateSmsCode()
    expect(code).toMatch(/^\d{6}$/)
  })

  it('自定义 4 位', () => {
    const code = generateSmsCode(4)
    expect(code).toMatch(/^\d{4}$/)
  })

  it('length=0 → 空', () => {
    expect(generateSmsCode(0)).toBe('')
  })

  it('length=10 → 10 位', () => {
    expect(generateSmsCode(10)).toMatch(/^\d{10}$/)
  })

  it('连续两次生成的码有差异(随机性,允许极小概率相同)', () => {
    const a = generateSmsCode()
    const b = generateSmsCode()
    // 6 位纯数字完全相同概率 1/10^6,实际跑 1000 次才有一次碰撞
    // 这里只在测试环境做软验证(连续两次相同极少出现)
    expect(a).not.toBe(b)
  })
})

describe('maskMiddle', () => {
  it('默认头 3 尾 4', () => {
    expect(maskMiddle('110101199001011234')).toBe('110***********1234')
  })

  it('头 4 尾 4(银行卡典型)', () => {
    expect(maskMiddle('6222021234567890', 4, 4)).toBe('6222********7890')
  })

  it('长度 ≤ head+tail 时全部 ***', () => {
    expect(maskMiddle('12345', 3, 4)).toBe('*****')
    expect(maskMiddle('1234567', 3, 4)).toBe('*******')
  })

  it('空字符串 → 空', () => {
    expect(maskMiddle('')).toBe('')
  })

  it('非字符串 → 空', () => {
    expect(maskMiddle(null as unknown as string)).toBe('')
  })

  it('头 0 尾 0 全部脱敏', () => {
    expect(maskMiddle('123456', 0, 0)).toBe('******')
  })
})
