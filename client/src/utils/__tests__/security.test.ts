import { describe, it, expect } from 'vitest'
import {
  InputValidator,
} from '../security'

describe('security.ts', () => {
  describe('InputValidator.isEmail', () => {
    it('应该验证正确的邮箱格式', () => {
      expect(InputValidator.isEmail('test@example.com')).toBe(true)
      expect(InputValidator.isEmail('user.name@domain.co.uk')).toBe(true)
      expect(InputValidator.isEmail('test+tag@example.org')).toBe(true)
    })

    it('应该拒绝错误的邮箱格式', () => {
      expect(InputValidator.isEmail('invalid-email')).toBe(false)
      expect(InputValidator.isEmail('test@')).toBe(false)
      expect(InputValidator.isEmail('@example.com')).toBe(false)
      expect(InputValidator.isEmail('test @example.com')).toBe(false)
    })

    it('应该拒绝空字符串', () => {
      expect(InputValidator.isEmail('')).toBe(false)
    })
  })

  describe('InputValidator.isValidEmail', () => {
    it('应该作为isEmail的别名工作', () => {
      expect(InputValidator.isValidEmail('test@example.com')).toBe(true)
      expect(InputValidator.isValidEmail('invalid')).toBe(false)
    })
  })

  describe('InputValidator.isPhone', () => {
    it('应该验证正确的中国大陆手机号', () => {
      expect(InputValidator.isPhone('13812345678')).toBe(true)
      expect(InputValidator.isPhone('15912345678')).toBe(true)
      expect(InputValidator.isPhone('18812345678')).toBe(true)
      expect(InputValidator.isPhone('19912345678')).toBe(true)
    })

    it('应该拒绝错误的手机号格式', () => {
      expect(InputValidator.isPhone('12345678901')).toBe(false)
      expect(InputValidator.isPhone('1381234567')).toBe(false)
      expect(InputValidator.isPhone('138123456789')).toBe(false)
      expect(InputValidator.isPhone('02812345678')).toBe(false)
    })

    it('应该拒绝空字符串', () => {
      expect(InputValidator.isPhone('')).toBe(false)
    })
  })

  describe('InputValidator.isValidPhone', () => {
    it('应该作为isPhone的别名工作', () => {
      expect(InputValidator.isValidPhone('13812345678')).toBe(true)
      expect(InputValidator.isValidPhone('12345678901')).toBe(false)
    })
  })

  describe('InputValidator.isRequired', () => {
    it('应该验证非空字符串', () => {
      expect(InputValidator.isRequired('hello')).toBe(true)
      expect(InputValidator.isRequired('  hello  ')).toBe(true)
    })

    it('应该拒绝空字符串和空白', () => {
      expect(InputValidator.isRequired('')).toBe(false)
      expect(InputValidator.isRequired('   ')).toBe(false)
    })

    it('应该验证非字符串类型', () => {
      expect(InputValidator.isRequired(123)).toBe(true)
      expect(InputValidator.isRequired(0)).toBe(true)
      expect(InputValidator.isRequired(null)).toBe(false)
      expect(InputValidator.isRequired(undefined)).toBe(false)
      expect(InputValidator.isRequired([])).toBe(true)
      expect(InputValidator.isRequired({})).toBe(true)
      expect(InputValidator.isRequired(false)).toBe(true)
    })
  })

  describe('InputValidator.minLength', () => {
    it('应该验证最小长度', () => {
      expect(InputValidator.minLength('hello', 3)).toBe(true)
      expect(InputValidator.minLength('hi', 3)).toBe(false)
      expect(InputValidator.minLength('abc', 3)).toBe(true)
    })

    it('应该处理空字符串', () => {
      expect(InputValidator.minLength('', 0)).toBe(true)
      expect(InputValidator.minLength('', 1)).toBe(false)
    })
  })

  describe('InputValidator.maxLength', () => {
    it('应该验证最大长度', () => {
      expect(InputValidator.maxLength('hello', 10)).toBe(true)
      expect(InputValidator.maxLength('hello world', 5)).toBe(false)
      expect(InputValidator.maxLength('abc', 3)).toBe(true)
    })

    it('应该处理空字符串', () => {
      expect(InputValidator.maxLength('', 0)).toBe(true)
      expect(InputValidator.maxLength('', 1)).toBe(true)
    })
  })

  describe('InputValidator.getPasswordStrength', () => {
    it('弱密码应该返回weak', () => {
      expect(InputValidator.getPasswordStrength('123')).toBe('weak')
      expect(InputValidator.getPasswordStrength('abc')).toBe('weak')
      expect(InputValidator.getPasswordStrength('password')).toBe('weak')
      expect(InputValidator.getPasswordStrength('ABCDEFGH')).toBe('weak')
    })

    it('中等密码应该返回medium', () => {
      expect(InputValidator.getPasswordStrength('Abcdefgh')).toBe('medium')
      expect(InputValidator.getPasswordStrength('abcdefgh1')).toBe('medium')
    })

    it('强密码应该返回strong', () => {
      expect(InputValidator.getPasswordStrength('Password123!')).toBe('strong')
      expect(InputValidator.getPasswordStrength('Abcdefg1@')).toBe('strong')
      expect(InputValidator.getPasswordStrength('Test1234!')).toBe('strong')
    })

    it('应该处理空密码', () => {
      expect(InputValidator.getPasswordStrength('')).toBe('weak')
    })
  })

  describe('InputValidator.validatePasswordStrength', () => {
    it('应该返回完整的验证结果', () => {
      const result = InputValidator.validatePasswordStrength('Password123!')
      expect(result.strength).toBe('strong')
      expect(result.valid).toBe(true)
      expect(result.score).toBe(4)
      expect(result.suggestions).toHaveLength(0)
    })

    it('应该返回改进建议', () => {
      const result = InputValidator.validatePasswordStrength('pass')
      expect(result.strength).toBe('weak')
      expect(result.valid).toBe(false)
      expect(result.suggestions.length).toBeGreaterThan(0)
    })

    it('应该为中等密码返回正确结果', () => {
      const result = InputValidator.validatePasswordStrength('Abcdefgh')
      expect(result.strength).toBe('medium')
      expect(result.valid).toBe(true)
      expect(result.score).toBe(2)
    })

    it('应该为弱密码返回正确结果', () => {
      const result = InputValidator.validatePasswordStrength('abcdefg')
      expect(result.strength).toBe('weak')
      expect(result.valid).toBe(false)
    })

    it('应该处理空密码', () => {
      const result = InputValidator.validatePasswordStrength('')
      expect(result.strength).toBe('weak')
      expect(result.valid).toBe(false)
      expect(result.suggestions.length).toBeGreaterThan(0)
    })
  })

  describe('InputValidator.isValidCode', () => {
    it('应该验证6位验证码', () => {
      expect(InputValidator.isValidCode('123456')).toBe(true)
      expect(InputValidator.isValidCode('000000')).toBe(true)
      expect(InputValidator.isValidCode('999999')).toBe(true)
    })

    it('应该拒绝错误的验证码格式', () => {
      expect(InputValidator.isValidCode('12345')).toBe(false)
      expect(InputValidator.isValidCode('1234567')).toBe(false)
      expect(InputValidator.isValidCode('abcdef')).toBe(false)
      expect(InputValidator.isValidCode('')).toBe(false)
    })

    it('应该支持自定义长度', () => {
      expect(InputValidator.isValidCode('1234', 4)).toBe(true)
      expect(InputValidator.isValidCode('12345678', 8)).toBe(true)
      expect(InputValidator.isValidCode('123', 4)).toBe(false)
    })
  })
})
