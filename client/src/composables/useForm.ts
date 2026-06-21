import { ref, reactive, type Ref } from 'vue'

export interface FormRule {
  /** 是否必填 */
  required?: boolean
  /** 正则校验 */
  pattern?: RegExp
  /** 自定义校验函数 */
  validator?: (value: any) => boolean | string
  /** 错误提示信息 */
  message?: string
  /** 最小长度 */
  minLength?: number
  /** 最大长度 */
  maxLength?: number
  /** 最小值 */
  min?: number
  /** 最大值 */
  max?: number
}

export type FormRules<T = Record<string, unknown>> = {
  [K in keyof T]?: FormRule[]
}

export interface UseFormOptions<T = Record<string, unknown>> {
  /** 初始值 */
  initialValues?: T
  /** 校验规则 */
  rules?: FormRules<T>
  /** 提交函数 */
  onSubmit?: (values: T) => Promise<void> | void
}

export interface UseFormReturn<T = Record<string, unknown>> {
  /** 表单数据 */
  form: T
  /** 错误信息 */
  errors: Record<string, string>
  /** 校验规则 */
  rules: FormRules<T>
  /** 是否正在提交 */
  isSubmitting: Ref<boolean>
  /** 校验整个表单 */
  validate: () => boolean
  /** 校验单个字段 */
  validateField: (field: keyof T) => boolean
  /** 设置错误信息 */
  setError: (field: keyof T, message: string) => void
  /** 清除错误信息 */
  clearError: (field: keyof T) => void
  /** 清除所有错误 */
  clearErrors: () => void
  /** 重置表单 */
  resetForm: (values?: T) => void
  /** 提交表单 */
  handleSubmit: () => Promise<void>
  /** 设置字段值 */
  setFieldValue: <K extends keyof T>(field: K, value: T[K]) => void
  /** 设置多个字段值 */
  setValues: (values: Partial<T>) => void
}

export function useForm<T extends Record<string, unknown> = Record<string, unknown>>(
  options: UseFormOptions<T> = {}
): UseFormReturn<T> {
  const { initialValues = {} as T, rules = {} as FormRules<T>, onSubmit } = options

  const form = reactive({ ...initialValues }) as T
  const errors = reactive({} as Record<string, string>)
  const isSubmitting = ref(false)

  const validateField = (field: keyof T): boolean => {
    const fieldRules = rules[field]
    if (!fieldRules) return true

    const value = form[field]
    delete errors[field as string]

    for (const rule of fieldRules) {
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors[field as string] = rule.message || `${String(field)} 是必填项`
        return false
      }

      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        errors[field as string] = rule.message || `${String(field)} 格式不正确`
        return false
      }

      if (rule.validator) {
        const result = rule.validator(value)
        if (result !== true) {
          errors[field as string] = typeof result === 'string' ? result : rule.message || `${String(field)} 校验失败`
          return false
        }
      }

      if (rule.minLength !== undefined && typeof value === 'string' && value.length < rule.minLength) {
        errors[field as string] = rule.message || `${String(field)} 长度不能少于 ${rule.minLength}`
        return false
      }

      if (rule.maxLength !== undefined && typeof value === 'string' && value.length > rule.maxLength) {
        errors[field as string] = rule.message || `${String(field)} 长度不能超过 ${rule.maxLength}`
        return false
      }

      if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
        errors[field as string] = rule.message || `${String(field)} 不能小于 ${rule.min}`
        return false
      }

      if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
        errors[field as string] = rule.message || `${String(field)} 不能大于 ${rule.max}`
        return false
      }
    }

    return true
  }

  const validate = (): boolean => {
    let valid = true
    for (const field in rules) {
      if (!validateField(field as keyof T)) {
        valid = false
      }
    }
    return valid
  }

  const setError = (field: keyof T, message: string): void => {
    errors[field as string] = message
  }

  const clearError = (field: keyof T): void => {
    delete errors[field as string]
  }

  const clearErrors = (): void => {
    for (const key in errors) {
      delete errors[key]
    }
  }

  const resetForm = (values?: T): void => {
    const resetValues = values || initialValues
    for (const key in form) {
      ;(form as Record<string, unknown>)[key] = (resetValues as Record<string, unknown>)[key]
    }
    clearErrors()
  }

  const handleSubmit = async (): Promise<void> => {
    if (!validate()) return

    isSubmitting.value = true
    try {
      if (onSubmit) {
        await onSubmit(form as T)
      }
    } finally {
      isSubmitting.value = false
    }
  }

  const setFieldValue = <K extends keyof T>(field: K, value: T[K]): void => {
    ;(form as Record<string, unknown>)[field as string] = value
  }

  const setValues = (values: Partial<T>): void => {
    for (const key in values) {
      ;(form as Record<string, unknown>)[key] = values[key]
    }
  }

  return {
    form,
    errors,
    rules,
    isSubmitting,
    validate,
    validateField,
    setError,
    clearError,
    clearErrors,
    resetForm,
    handleSubmit,
    setFieldValue,
    setValues,
  }
}
