import { describe, it, expect, beforeEach } from 'vitest'
import { analyzePassword, getPasswordStrengthColor, getPasswordStrengthLabel, isPasswordAcceptable } from '../passwordStrength'

describe('passwordStrength', () => {
  describe('analyzePassword', () => {
    it('should return weak for short passwords', () => {
      const result = analyzePassword('abc')
      expect(result.strength).toBe('weak')
      expect(result.length).toBe(3)
    })

    it('should return weak for common passwords', () => {
      const result = analyzePassword('password123')
      expect(result.strength).toBe('weak')
      expect(result.suggestions).toContain('避免使用常见密码')
    })

    it('should return medium for basic passwords', () => {
      const result = analyzePassword('MySecure1')
      expect(result.strength).toBe('medium')
      expect(result.hasLowercase).toBe(true)
      expect(result.hasUppercase).toBe(true)
      expect(result.hasNumber).toBe(true)
    })

    it('should return strong for good passwords', () => {
      const result = analyzePassword('MySecure@Pass9')
      expect(result.strength).toBe('strong')
    })

    it('should return very-strong for excellent passwords', () => {
      const result = analyzePassword('MyV3ry$tr0ngP@ssw0rd!')
      expect(result.strength).toBe('very-strong')
    })

    it('should detect repeated characters', () => {
      const result = analyzePassword('Passsssword123!')
      expect(result.suggestions).toContain('避免连续重复字符')
    })

    it('should detect sequential characters', () => {
      const result = analyzePassword('Password123abc!')
      expect(result.suggestions).toContain('避免连续字符序列')
    })

    it('should provide suggestions for improvement', () => {
      const result = analyzePassword('password')
      expect(result.suggestions.length).toBeGreaterThan(0)
    })
  })

  describe('getPasswordStrengthColor', () => {
    it('should return correct color for weak', () => {
      expect(getPasswordStrengthColor('weak')).toBe('var(--color-danger-variant)')
    })

    it('should return correct color for medium', () => {
      expect(getPasswordStrengthColor('medium')).toBe('var(--color-warning-variant)')
    })

    it('should return correct color for strong', () => {
      expect(getPasswordStrengthColor('strong')).toBe('var(--color-success)')
    })

    it('should return correct color for very-strong', () => {
      expect(getPasswordStrengthColor('very-strong')).toBe('var(--color-primary)')
    })
  })

  describe('getPasswordStrengthLabel', () => {
    const mockT = (key: string) => {
      const labels: Record<string, string> = {
        'settings.passwordStrength.weak': '弱',
        'settings.passwordStrength.medium': '中',
        'settings.passwordStrength.strong': '强',
        'settings.passwordStrength.veryStrong': '非常强',
      }
      return labels[key] || key
    }

    it('should return translated label', () => {
      expect(getPasswordStrengthLabel('weak', mockT)).toBe('弱')
      expect(getPasswordStrengthLabel('strong', mockT)).toBe('强')
    })
  })

  describe('isPasswordAcceptable', () => {
    it('should return false for weak passwords', () => {
      expect(isPasswordAcceptable('abc')).toBe(false)
      expect(isPasswordAcceptable('password')).toBe(false)
    })

    it('should return true for acceptable passwords', () => {
      expect(isPasswordAcceptable('MySecure1')).toBe(true)
      expect(isPasswordAcceptable('MySecure123!')).toBe(true)
    })

    it('should return false for short passwords', () => {
      expect(isPasswordAcceptable('Pass1!')).toBe(false)
    })
  })
})
