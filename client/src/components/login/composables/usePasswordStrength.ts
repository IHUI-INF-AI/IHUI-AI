/**
 * 密码强度检测组合函数
 */

import { useI18n } from 'vue-i18n'

export interface PasswordStrength {
  score: number // 0-4分
  feedback: string[]
  suggestions: string[]
}

export function usePasswordStrength() {
  const { t } = useI18n()
  /**
   * 计算密码强度
   */
  const calculateStrength = (password: string): PasswordStrength => {
    if (!password) {
      return {
        score: 0,
        feedback: [t('auth.passwordPleaseEnter')],
        suggestions: [],
      }
    }

    let score = 0
    const feedback: string[] = []
    const suggestions: string[] = []

    // 长度检查
    if (password.length >= 8) {
      score += 1
    } else {
      feedback.push(t('auth.passwordLengthInsufficient'))
      suggestions.push(t('auth.passwordMinLength'))
    }

    // 包含小写字母
    if (/[a-z]/.test(password)) {
      score += 1
    } else {
      suggestions.push(t('auth.passwordAddLowercase'))
    }

    // 包含大写字母
    if (/[A-Z]/.test(password)) {
      score += 1
    } else {
      suggestions.push(t('auth.passwordAddUppercase'))
    }

    // 包含数字
    if (/\d/.test(password)) {
      score += 1
    } else {
      suggestions.push(t('auth.passwordAddNumber'))
    }

    // 包含特殊字符
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 1
    } else {
      suggestions.push(t('auth.passwordAddSpecial'))
    }

    // 检查常见弱密码模式
    const commonPatterns = [/123456/, /password/i, /qwerty/i, /abc123/i, /111111/, /000000/]

    const hasCommonPattern = commonPatterns.some(pattern => pattern.test(password))
    if (hasCommonPattern) {
      score = Math.max(0, score - 2)
      feedback.push(t('auth.passwordCommonPattern'))
      suggestions.push(t('auth.passwordAvoidCommon'))
    }

    // 检查重复字符
    const hasRepeatedChars = /(.)\1{2,}/.test(password)
    if (hasRepeatedChars) {
      score = Math.max(0, score - 1)
      feedback.push(t('auth.passwordRepeatedChars'))
      suggestions.push(t('auth.passwordAvoidRepeated'))
    }

    // 限制最高分数
    score = Math.min(4, score)

    return {
      score,
      feedback,
      suggestions,
    }
  }

  /**
   * 获取强度等级文本
   */
  const getStrengthText = (score: number): string => {
    switch (score) {
      case 0:
      case 1:
        return t('auth.passwordWeak')
      case 2:
      case 3:
        return t('auth.passwordMedium')
      case 4:
        return t('auth.passwordStrong')
      default:
        return t('auth.passwordUnknown')
    }
  }

  /**
   * 获取强度颜色
   */
  const getStrengthColor = (score: number): string => {
    switch (score) {
      case 0:
      case 1:
        return 'var(--color-danger-variant)'
      case 2:
      case 3:
        return 'var(--color-warning-variant)'
      case 4:
        return 'var(--color-success)'
      default:
        return 'var(--el-text-color-primary)'
    }
  }

  /**
   * 检查密码是否足够强
   */
  const isPasswordStrong = (password: string): boolean => {
    const strength = calculateStrength(password)
    return strength.score >= 3
  }

  return {
    calculateStrength,
    getStrengthText,
    getStrengthColor,
    isPasswordStrong,
  }
}
