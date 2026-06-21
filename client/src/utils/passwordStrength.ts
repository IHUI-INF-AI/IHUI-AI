export type PasswordStrength = 'weak' | 'medium' | 'strong' | 'very-strong'

export interface PasswordAnalysis {
  strength: PasswordStrength
  score: number
  length: number
  hasLowercase: boolean
  hasUppercase: boolean
  hasNumber: boolean
  hasSpecialChar: boolean
  suggestions: string[]
}

const SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`'

export function analyzePassword(password: string): PasswordAnalysis {
  const length = password.length
  const hasLowercase = /[a-z]/.test(password)
  const hasUppercase = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecialChar = new RegExp(`[${SPECIAL_CHARS}]`).test(password)

  let score = 0
  const suggestions: string[] = []

  if (length >= 8) score += 1
  if (length >= 12) score += 1
  if (length >= 16) score += 1
  if (hasLowercase) score += 1
  if (hasUppercase) score += 1
  if (hasNumber) score += 1
  if (hasSpecialChar) score += 1

  if (length < 8) suggestions.push('密码长度至少8位')
  if (!hasLowercase) suggestions.push('添加小写字母')
  if (!hasUppercase) suggestions.push('添加大写字母')
  if (!hasNumber) suggestions.push('添加数字')
  if (!hasSpecialChar) suggestions.push('添加特殊字符')

  const commonPatterns = [
    'password', '123456', 'qwerty', 'abc123', 'admin', 'letmein',
    'welcome', 'monkey', 'dragon', 'master', 'login', 'passw0rd',
  ]
  const lowerPassword = password.toLowerCase()
  if (commonPatterns.some(p => lowerPassword.includes(p))) {
    score -= 2
    suggestions.push('避免使用常见密码')
  }

  if (/(.)\1{2,}/.test(password)) {
    score -= 1
    suggestions.push('避免连续重复字符')
  }

  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)) {
    score -= 1
    suggestions.push('避免连续字符序列')
  }

  score = Math.max(0, Math.min(7, score))

  let strength: PasswordStrength
  if (score <= 2) strength = 'weak'
  else if (score <= 4) strength = 'medium'
  else if (score <= 5) strength = 'strong'
  else strength = 'very-strong'

  return {
    strength,
    score,
    length,
    hasLowercase,
    hasUppercase,
    hasNumber,
    hasSpecialChar,
    suggestions,
  }
}

export function getPasswordStrengthColor(strength: PasswordStrength): string {
  const colors: Record<PasswordStrength, string> = {
    'weak': 'var(--color-danger-variant)',
    'medium': 'var(--color-warning-variant)',
    'strong': 'var(--color-success)',
    'very-strong': 'var(--color-primary)',
  }
  return colors[strength]
}

export function getPasswordStrengthLabel(strength: PasswordStrength, t: (key: string) => string): string {
  const labels: Record<PasswordStrength, string> = {
    'weak': t('settings.passwordStrength.weak'),
    'medium': t('settings.passwordStrength.medium'),
    'strong': t('settings.passwordStrength.strong'),
    'very-strong': t('settings.passwordStrength.veryStrong'),
  }
  return labels[strength]
}

export function isPasswordAcceptable(password: string): boolean {
  const analysis = analyzePassword(password)
  return analysis.strength !== 'weak' && password.length >= 8
}
