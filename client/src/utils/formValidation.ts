import { t } from '@/utils/i18n'

/**
 * 表单验证工具类
 * 提供通用的表单验证功能
 */

// 类型定义
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface ValidationConfig {
  required?: boolean
  allowEmpty?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  customValidator?: (value: string) => ValidationResult
}

export interface ExtendedFormItemRule {
  required?: boolean
  message?: string
  trigger?: string | string[]
  validator?: (rule: any, value: any, callback: (error?: Error) => void) => void
  pattern?: RegExp
  min?: number
  max?: number
}

export class FormValidator {
  /**
   * 检查是否包含XSS攻击代码
   */
  static containsXSS(value: string): boolean {
    if (!value) return false

    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]+src[^>]*>/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
      /<link\b[^<]*>/gi,
      /<meta\b[^<]*>/gi,
      /expression\s*\(/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
    ]

    return xssPatterns.some(pattern => pattern.test(value))
  }

  /**
   * 检查是否包含SQL注入代码
   */
  static containsSQLInjection(value: string): boolean {
    if (!value) return false

    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
      /(--|#|\/\*|\*\/)/g,
      /(\b(OR|AND)\b.*=.*)/gi,
      /('|(\\')|(;)|(\\))/g,
      /(\b(CHAR|NCHAR|VARCHAR|NVARCHAR)\b\s*\()/gi,
    ]

    return sqlPatterns.some(pattern => pattern.test(value))
  }

  /**
   * 清理HTML标签
   */
  static stripHtml(value: string): string {
    if (!value) return ''
    return value.replace(/<[^>]*>/g, '')
  }

  /**
   * 转义HTML特殊字符
   */
  static escapeHtml(value: string): string {
    if (!value) return ''

    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    }

    return value.replace(/[&<>"'/]/g, match => htmlEscapes[match])
  }

  /**
   * 验证字符串长度
   */
  static validateLength(value: string, min: number, max: number): boolean {
    if (!value) return min === 0
    return value.length >= min && value.length <= max
  }

  /**
   * 验证是否只包含允许的字符
   */
  static validateCharacters(value: string, pattern: RegExp): boolean {
    if (!value) return true
    return pattern.test(value)
  }

  /**
   * 验证是否为有效的用户名
   */
  static isValidUsername(value: string): boolean {
    if (!value) return false

    // 用户名规则：3-20位，只能包含字母、数字、下划线和中文
    const usernamePattern = /^[a-zA-Z0-9_\u4e00-\u9fa5]{3,20}$/
    return usernamePattern.test(value) && !this.containsXSS(value)
  }

  /**
   * 验证用户名（返回ValidationResult）
   */
  static validateUsername(value: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!value || value.trim() === '') {
      errors.push('用户名不能为空')
      return { valid: false, errors, warnings }
    }

    if (!this.isValidUsername(value)) {
      errors.push('用户名格式不正确（3-20位，只能包含字母、数字、下划线和中文）')
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  /**
   * 验证密码（返回ValidationResult）
   */
  static validatePassword(password: string): ValidationResult {
    return this.validatePasswordStrength(password)
  }

  /**
   * 验证密码强度
   */
  static validatePasswordStrength(password: string): {
    valid: boolean
    errors: string[]
    warnings: string[]
    strength: 'weak' | 'medium' | 'strong'
  } {
    const errors: string[] = []
    const warnings: string[] = []

    if (password.length < 8) {
      errors.push('密码长度不能少于8个字符')
    }
    if (password.length > 128) {
      errors.push('密码长度不能超过128个字符')
    }

    // 复杂度检查
    const hasLowerCase = /[a-z]/.test(password)
    const hasUpperCase = /[A-Z]/.test(password)
    const hasNumbers = /\d/.test(password)
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)

    let complexity = 0
    if (hasLowerCase) complexity++
    if (hasUpperCase) complexity++
    if (hasNumbers) complexity++
    if (hasSpecialChar) complexity++

    if (complexity < 3) {
      errors.push('密码必须包含至少3种字符类型（大写字母、小写字母、数字、特殊字符）')
    }

    // 常见弱密码检查
    const weakPasswords = [
      'password',
      '123456',
      '123456789',
      'qwerty',
      'abc123',
      'password123',
      '123123',
      'admin',
      'root',
      '000000',
    ]
    if (weakPasswords.includes(password.toLowerCase())) {
      errors.push('密码过于简单，请使用更复杂的密码')
    }

    // 连续字符检查
    if (/(.)\1{2,}/.test(password)) {
      warnings.push('密码包含连续重复字符，建议修改')
    }

    // 键盘序列检查
    const keyboardSequences = ['qwerty', 'asdfgh', 'zxcvbn', '123456', '654321']
    if (keyboardSequences.some(seq => password.toLowerCase().includes(seq))) {
      warnings.push('密码包含键盘序列，建议修改')
    }

    // 计算密码强度等级（通用规则）
    // 弱：只有1种字符类型
    // 中等：有2-3种字符类型
    // 强：有4种字符类型，或3种且长度>=10
    let strength: 'weak' | 'medium' | 'strong' = 'weak'
    if (complexity >= 4 || (complexity >= 3 && password.length >= 10)) {
      strength = 'strong'
    } else if (complexity >= 2) {
      strength = 'medium'
    }

    return { valid: errors.length === 0, errors, warnings, strength }
  }

  /**
   * 手机号验证
   * @param phone 手机号
   * @returns 验证结果
   */
  static validatePhone(phone: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!phone || phone.trim() === '') {
      errors.push('手机号不能为空')
      return { valid: false, errors, warnings }
    }

    // 移除空格和特殊字符
    const cleanPhone = phone.replace(/[\s-()]/g, '')

    // 中国大陆手机号验证
    if (!/^1[3-9]\d{9}$/.test(cleanPhone)) {
      errors.push('请输入正确的手机号格式')
    }

    // 检查是否为虚拟号段（可选）
    const virtualPrefixes = ['170', '171', '172']
    if (virtualPrefixes.some(prefix => cleanPhone.startsWith(prefix))) {
      warnings.push('检测到虚拟号段，请确认号码正确')
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  /**
   * 邮箱验证
   * @param email 邮箱
   * @returns 验证结果
   */
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!email || email.trim() === '') {
      errors.push('邮箱不能为空')
      return { valid: false, errors, warnings }
    }

    // 基本格式验证
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
      errors.push('请输入正确的邮箱格式')
    }

    // 长度检查
    if (email.length > 254) {
      errors.push('邮箱长度不能超过254个字符')
    }

    // 本地部分长度检查
    const localPart = email.split('@')[0]
    if (localPart && localPart.length > 64) {
      errors.push('邮箱用户名部分不能超过64个字符')
    }

    // 临时邮箱检查
    const tempEmailDomains = [
      '10minutemail.com',
      'tempmail.org',
      'guerrillamail.com',
      'mailinator.com',
      'throwaway.email',
    ]
    const domain = email.split('@')[1]?.toLowerCase()
    if (domain && tempEmailDomains.includes(domain)) {
      warnings.push('检测到临时邮箱，建议使用常用邮箱')
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  /**
   * 验证码验证
   * @param code 验证码
   * @param expectedLength 期望长度
   * @returns 验证结果
   */
  static validateVerificationCode(code: string, expectedLength: number = 6): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!code || code.trim() === '') {
      errors.push('验证码不能为空')
      return { valid: false, errors, warnings }
    }

    // 长度检查
    if (code.length !== expectedLength) {
      errors.push(`验证码必须为${expectedLength}位`)
    }

    // 格式检查（纯数字）
    if (!/^\d+$/.test(code)) {
      errors.push('验证码只能包含数字')
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  /**
   * 金额验证
   * @param amount 金额
   * @param min 最小值
   * @param max 最大值
   * @returns 验证结果
   */
  static validateAmount(
    amount: string | number,
    min: number = 0,
    max: number = Infinity
  ): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (amount === '' || amount === null || amount === undefined) {
      errors.push('金额不能为空')
      return { valid: false, errors, warnings }
    }

    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount

    if (isNaN(numAmount)) {
      errors.push('请输入有效的金额')
      return { valid: false, errors, warnings }
    }

    if (numAmount < min) {
      errors.push(`金额不能小于${min}`)
    }

    if (numAmount > max) {
      errors.push(`金额不能大于${max}`)
    }

    // 小数位检查
    const decimalPlaces = amount.toString().split('.')[1]?.length || 0
    if (decimalPlaces > 2) {
      errors.push('金额最多保留2位小数')
    }

    // 异常金额警告
    if (numAmount > 10000) {
      warnings.push('金额较大，请确认输入正确')
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  /**
   * 通用文本验证
   * @param text 文本
   * @param config 验证配置
   * @returns 验证结果
   */
  static validateText(text: string, config: ValidationConfig): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 必填检查
    if (config.required && (!text || text.trim() === '')) {
      errors.push('此字段为必填项')
      return { valid: false, errors, warnings }
    }

    // 如果允许空值且为空，直接返回有效
    if (config.allowEmpty && (!text || text.trim() === '')) {
      return { valid: true, errors, warnings }
    }

    if (text) {
      // 长度检查
      if (config.minLength && text.length < config.minLength) {
        errors.push(`长度不能少于${config.minLength}个字符`)
      }
      if (config.maxLength && text.length > config.maxLength) {
        errors.push(`长度不能超过${config.maxLength}个字符`)
      }

      // 格式检查
      if (config.pattern && !config.pattern.test(text)) {
        errors.push('格式不正确')
      }

      // XSS检查
      if (this.containsXSS(text)) {
        errors.push('输入内容包含不安全字符')
      }

      // 自定义验证
      if (config.customValidator) {
        const customResult = config.customValidator(text)
        if (customResult && typeof customResult === 'object' && 'errors' in customResult) {
          errors.push(...customResult.errors)
          warnings.push(...customResult.warnings)
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  // containsXSS 方法已在上面定义，此处删除重复实现

  /**
   * 清理用户输入
   * @param text 文本
   * @returns 清理后的文本
   */
  static sanitizeInput(text: string): string {
    if (!text) return ''

    return (
      text
        .trim()
        .replace(/[<>]/g, '') // 移除尖括号
        .replace(/javascript:/gi, '') // 移除javascript协议
        .replace(/on\w+\s*=/gi, '') // 移除事件处理器
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1F\x7F]/g, '')
    ) // 移除控制字符
  }
}

/**
 * Element Plus 表单规则生成器
 */
export class ElementFormRules {
  /**
   * 生成用户名验证规则
   * @returns 表单规则
   */
  static username(): ExtendedFormItemRule[] {
    return [
      { required: true, message: t('api.form_validation.请输入用户名'), trigger: 'blur' },
      {
        validator: (_rule, value, callback) => {
          const result = FormValidator.validateUsername(String(value || ''))
          if (!result.valid) {
            callback(new Error(result.errors[0]))
          } else {
            callback()
          }
        },
        trigger: 'blur',
      },
    ]
  }

  /**
   * 生成密码验证规则
   * @returns 表单规则
   */
  static password(): ExtendedFormItemRule[] {
    return [
      { required: true, message: t('api.form_validation.请输入密码1'), trigger: 'blur' },
      {
        validator: (_rule, value, callback) => {
          const result = FormValidator.validatePassword(String(value || ''))
          if (!result.valid) {
            callback(new Error(result.errors[0]))
          } else {
            callback()
          }
        },
        trigger: 'blur',
      },
    ]
  }

  /**
   * 生成手机号验证规则
   * @returns 表单规则
   */
  static phone(): ExtendedFormItemRule[] {
    return [
      { required: true, message: t('api.form_validation.请输入手机号2'), trigger: 'blur' },
      {
        validator: (_rule, value, callback) => {
          const result = FormValidator.validatePhone(String(value || ''))
          if (!result.valid) {
            callback(new Error(result.errors[0]))
          } else {
            callback()
          }
        },
        trigger: 'blur',
      },
    ]
  }

  /**
   * 生成邮箱验证规则
   * @returns 表单规则
   */
  static email(): ExtendedFormItemRule[] {
    return [
      { required: true, message: t('api.form_validation.请输入邮箱3'), trigger: 'blur' },
      {
        validator: (_rule, value, callback) => {
          const result = FormValidator.validateEmail(String(value || ''))
          if (!result.valid) {
            callback(new Error(result.errors[0]))
          } else {
            callback()
          }
        },
        trigger: 'blur',
      },
    ]
  }

  /**
   * 生成验证码验证规则
   * @param length 验证码长度
   * @returns 表单规则
   */
  static verificationCode(length: number = 6): ExtendedFormItemRule[] {
    return [
      { required: true, message: t('api.form_validation.请输入验证码4'), trigger: 'blur' },
      {
        validator: (_rule, value, callback) => {
          const result = FormValidator.validateVerificationCode(String(value || ''), length)
          if (!result.valid) {
            callback(new Error(result.errors[0]))
          } else {
            callback()
          }
        },
        trigger: 'blur',
      },
    ]
  }

  /**
   * 生成金额验证规则
   * @param min 最小值
   * @param max 最大值
   * @returns 表单规则
   */
  static amount(min: number = 0, max: number = Infinity): ExtendedFormItemRule[] {
    return [
      { required: true, message: t('api.form_validation.请输入金额5'), trigger: 'blur' },
      {
        validator: (_rule, value, callback) => {
          const result = FormValidator.validateAmount(
            typeof value === 'string'
              ? value
              : typeof value === 'number'
                ? value
                : String(value || 0),
            min,
            max
          )
          if (!result.valid) {
            callback(new Error(result.errors[0]))
          } else {
            callback()
          }
        },
        trigger: 'blur',
      },
    ]
  }

  /**
   * 生成确认密码验证规则
   * @param getPassword 获取原密码的函数
   * @returns 表单规则
   */
  static confirmPassword(getPassword: () => string): ExtendedFormItemRule[] {
    return [
      { required: true, message: t('api.form_validation.请确认密码6'), trigger: 'blur' },
      {
        validator: (_rule, value, callback) => {
          if (value !== getPassword()) {
            callback(new Error('两次输入密码不一致'))
          } else {
            callback()
          }
        },
        trigger: 'blur',
      },
    ]
  }

  /**
   * 生成自定义文本验证规则
   * @param config 验证配置
   * @param message 错误消息
   * @returns 表单规则
   */
  static customText(
    config: ValidationConfig,
    message: string = '输入格式不正确'
  ): ExtendedFormItemRule[] {
    const rules: ExtendedFormItemRule[] = []

    if (config.required) {
      rules.push({
        required: true,
        message: t('api.form_validation.此字段为必填项7'),
        trigger: 'blur',
      })
    }

    rules.push({
      validator: (_rule, value, callback) => {
        const result = FormValidator.validateText(String(value || ''), config)
        if (!result.valid) {
          callback(new Error(result.errors[0] || message))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    })

    return rules
  }
}

// 导出便捷函数
export const validateUsername = FormValidator.validateUsername
export const validatePassword = FormValidator.validatePassword
export const validatePhone = FormValidator.validatePhone
export const validateEmail = FormValidator.validateEmail
export const validateAmount = FormValidator.validateAmount
export const sanitizeInput = FormValidator.sanitizeInput

// Vue 3 Composition API Hook
export function useFormValidation() {
  return {
    FormValidator,
    validateUsername,
    validatePassword,
    validatePhone,
    validateEmail,
    validateAmount,
    sanitizeInput,
  }
}
