import { useFormRef } from '@/composables/useFormRef'

export interface CommonRule {
  required?: boolean
  message?: string
  trigger?: string
  min?: number
  max?: number
  pattern?: RegExp
}

export const commonRules = {
  required: (message = '此项为必填项'): CommonRule[] => [{ required: true, message, trigger: 'blur' }],
  min: (length: number, message?: string): CommonRule[] => [{ min: length, message: message || `最少 ${length} 个字符`, trigger: 'blur' }],
  max: (length: number, message?: string): CommonRule[] => [{ max: length, message: message || `最多 ${length} 个字符`, trigger: 'blur' }],
  stringLength: (min: number, max: number, message?: string): CommonRule[] => [{ min, max, message: message || `长度需在 ${min}-${max} 个字符之间`, trigger: 'blur' }],
}

export function validateForm(form: HTMLFormElement | null | undefined): Promise<boolean> {
  if (!form) return Promise.resolve(false)
  if (form instanceof HTMLFormElement) {
    const valid = form.checkValidity()
    if (!valid) {
      const invalid = form.querySelector<HTMLElement>(':invalid')
      invalid?.focus()
      ;(invalid as HTMLInputElement | null)?.reportValidity()
    }
    return Promise.resolve(valid)
  }
  // 兼容 useFormRef 返回的带 validate 方法的元素
  const formEl = form as unknown as { validate?: (callback?: (valid: boolean) => void) => Promise<boolean> }
  if (formEl.validate) {
    return formEl.validate()
  }
  return Promise.resolve(true)
}

export { useFormRef }
export default { validateForm, commonRules, useFormRef }
