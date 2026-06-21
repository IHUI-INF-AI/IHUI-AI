/**
 * 安全工具
 * 提供安全相关的功能
 */

/**
 * 密码强度结果
 */
export interface PasswordStrengthResult {
  strength: 'weak' | 'medium' | 'strong'
  valid: boolean
  score: number
  suggestions: string[]
}

/**
 * 输入验证器
 */
export const InputValidator = {
  /**
   * 验证邮箱格式
   */
  isEmail: (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  },

  /**
   * 验证邮箱格式（别名）
   */
  isValidEmail: (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  },

  /**
   * 验证手机号格式（中国大陆）
   */
  isPhone: (value: string): boolean => {
    return /^1[3-9]\d{9}$/.test(value)
  },

  /**
   * 验证手机号格式（别名）
   */
  isValidPhone: (value: string): boolean => {
    return /^1[3-9]\d{9}$/.test(value)
  },

  /**
   * 验证是否为必填
   */
  isRequired: (value: any): boolean => {
    if (typeof value === 'string') return value.trim().length > 0
    return value !== null && value !== undefined
  },

  /**
   * 验证最小长度
   */
  minLength: (value: string, length: number): boolean => {
    return value.length >= length
  },

  /**
   * 验证最大长度
   */
  maxLength: (value: string, length: number): boolean => {
    return value.length <= length
  },

  /**
   * 验证密码强度
   */
  getPasswordStrength: (password: string): 'weak' | 'medium' | 'strong' => {
    let score = 0
    if (password.length >= 8) score++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[^a-zA-Z0-9]/.test(password)) score++

    if (score <= 1) return 'weak'
    if (score === 2) return 'medium'
    return 'strong'
  },

  /**
   * 验证密码强度（返回对象格式）
   */
  validatePasswordStrength: (password: string): PasswordStrengthResult => {
    const suggestions: string[] = []
    let score = 0

    if (password.length >= 8) {
      score++
    } else {
      suggestions.push('密码长度至少8位')
    }

    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
      score++
    } else {
      suggestions.push('包含大小写字母')
    }

    if (/\d/.test(password)) {
      score++
    } else {
      suggestions.push('包含数字')
    }

    if (/[^a-zA-Z0-9]/.test(password)) {
      score++
    } else {
      suggestions.push('包含特殊字符')
    }

    let strength: 'weak' | 'medium' | 'strong' = 'weak'
    if (score >= 4) strength = 'strong'
    else if (score >= 2) strength = 'medium'

    return {
      strength,
      valid: score >= 2,
      score,
      suggestions
    }
  },

  /**
   * 验证验证码格式
   */
  isValidCode: (code: string, length = 6): boolean => {
    return new RegExp(`^\\d{${length}}$`).test(code)
  },
}

/**
 * XSS防护 - 转义HTML特殊字符
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * 检查密码强度
 */
export function checkPasswordStrength(password: string): {
  strength: 'weak' | 'medium' | 'strong'
  score: number
  suggestions: string[]
} {
  const suggestions: string[] = []
  let score = 0

  if (password.length >= 8) {
    score++
  } else {
    suggestions.push('密码长度至少8位')
  }

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score++
  } else {
    suggestions.push('包含大小写字母')
  }

  if (/\d/.test(password)) {
    score++
  } else {
    suggestions.push('包含数字')
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    score++
  } else {
    suggestions.push('包含特殊字符')
  }

  let strength: 'weak' | 'medium' | 'strong' = 'weak'
  if (score >= 4) strength = 'strong'
  else if (score >= 2) strength = 'medium'

  return { strength, score, suggestions }
}

/**
 * 生成随机字符串
 */
export function generateRandomString(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 生成随机验证码
 */
export function generateVerificationCode(length = 6): string {
  const digits = '0123456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += digits.charAt(Math.floor(Math.random() * digits.length))
  }
  return code
}
