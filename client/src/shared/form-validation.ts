import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { getI18nGlobal } from '@/locales'

export function validateForm(formRef: FormInstance | null): Promise<boolean> {
  if (!formRef) {
    ElMessage.warning(String(getI18nGlobal().t('messages.formRefNotFound')))
    return Promise.resolve(false)
  }

  return formRef
    .validate()
    .then(() => true)
    .catch(() => {
      ElMessage.warning(String(getI18nGlobal().t('messages.checkFormInput')))
      return false
    })
}

export function validateField(formRef: FormInstance | null, field: string): Promise<boolean> {
  if (!formRef) {
    return Promise.resolve(false)
  }

  return formRef
    .validateField(field)
    .then(() => true)
    .catch(() => false)
}

export function resetForm(formRef: FormInstance | null) {
  if (!formRef) {
    return
  }
  formRef.resetFields()
  formRef.clearValidate()
}

export const commonRules = {
  required: (message?: string) => ({
    required: true,
    message: message || String(getI18nGlobal().t('formValidation.required')),
    trigger: 'blur',
  }),
  email: () => ({
    type: 'email' as const,
    message: String(getI18nGlobal().t('formValidation.email')),
    trigger: 'blur',
  }),
  phone: () => ({
    pattern: /^1[3-9]\d{9}$/,
    message: String(getI18nGlobal().t('formValidation.phone')),
    trigger: 'blur',
  }),
  url: () => ({
    type: 'url',
    message: String(getI18nGlobal().t('formValidation.url')),
    trigger: 'blur',
  }),
  number: (min?: number, max?: number) => ({
    type: 'number',
    min,
    max,
    message:
      min !== undefined && max !== undefined
        ? String(getI18nGlobal().t('formValidation.numberRange', { min, max }))
        : min !== undefined
          ? String(getI18nGlobal().t('formValidation.numberMin', { min }))
          : max !== undefined
            ? String(getI18nGlobal().t('formValidation.numberMax', { max }))
            : String(getI18nGlobal().t('formValidation.number')),
    trigger: 'blur',
  }),
  stringLength: (min: number, max: number, message?: string) => ({
    min,
    max,
    message: message || String(getI18nGlobal().t('formValidation.stringLength', { min, max })),
    trigger: 'blur',
  }),
  positiveNumber: () => ({
    validator: (_rule: unknown, value: unknown, callback: (error?: Error) => void) => {
      if (value === undefined || value === null || value === '') {
        callback()
        return
      }
      const num = Number(value)
      if (isNaN(num) || num <= 0) {
        callback(new Error(String(getI18nGlobal().t('formValidation.positiveNumber'))))
      } else {
        callback()
      }
    },
    trigger: 'blur',
  }),
}

export const agentRules = {
  agentName: (): FormRules => ({
    agent_name: [
      commonRules.required(String(getI18nGlobal().t('formValidation.agentName'))),
      commonRules.stringLength(1, 100, String(getI18nGlobal().t('formValidation.agentNameLength'))),
    ],
  }),
  agentId: (): FormRules => ({
    agent_id: [
      commonRules.required(String(getI18nGlobal().t('formValidation.agentId'))),
      commonRules.stringLength(1, 200, String(getI18nGlobal().t('formValidation.agentIdLength'))),
    ],
  }),
  categoryId: (): FormRules => ({
    category_id: [commonRules.required(String(getI18nGlobal().t('formValidation.categoryRequired')))],
  }),
}

export const modelRules = {
  modelName: (): FormRules => ({
    name: [
      commonRules.required(String(getI18nGlobal().t('formValidation.modelName'))),
      commonRules.stringLength(1, 100, String(getI18nGlobal().t('formValidation.modelNameLength'))),
    ],
  }),
  modelId: (): FormRules => ({
    modelId: [
      commonRules.required(String(getI18nGlobal().t('formValidation.modelId'))),
      commonRules.stringLength(1, 200, String(getI18nGlobal().t('formValidation.modelIdLength'))),
    ],
  }),
  provider: (): FormRules => ({
    provider: [commonRules.required(String(getI18nGlobal().t('formValidation.providerRequired')))],
  }),
  maxTokens: (): FormRules => ({
    maxTokens: [commonRules.required(String(getI18nGlobal().t('formValidation.maxTokensRequired'))), commonRules.positiveNumber()],
  }),
  temperature: (): FormRules => ({
    temperature: [
      {
        validator: (_rule: unknown, value: unknown, callback: (error?: Error) => void) => {
          if (value === undefined || value === null || value === '') {
            callback()
            return
          }
          const num = Number(value)
          if (isNaN(num) || num < 0 || num > 2) {
            callback(new Error(String(getI18nGlobal().t('formValidation.temperatureRange'))))
          } else {
            callback()
          }
        },
        trigger: 'blur',
      },
    ],
  }),
}

export const userRules = {
  username: (): FormRules => ({
    username: [
      commonRules.required(String(getI18nGlobal().t('formValidation.username'))),
      commonRules.stringLength(3, 20, String(getI18nGlobal().t('formValidation.usernameLength'))),
      {
        pattern: /^[a-zA-Z0-9_]+$/,
        message: String(getI18nGlobal().t('formValidation.usernamePattern')),
        trigger: 'blur',
      },
    ],
  }),
  email: (): FormRules => ({
    email: [commonRules.required(String(getI18nGlobal().t('formValidation.emailRequired'))), commonRules.email()],
  }),
  phone: (): FormRules => ({
    phone: [commonRules.required(String(getI18nGlobal().t('formValidation.phoneRequired'))), commonRules.phone()],
  }),
  password: (): FormRules => ({
    password: [
      commonRules.required(String(getI18nGlobal().t('formValidation.passwordRequired'))),
      commonRules.stringLength(6, 20, String(getI18nGlobal().t('formValidation.passwordLength'))),
    ],
  }),
}
