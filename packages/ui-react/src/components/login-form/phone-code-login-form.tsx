'use client'

// 2026-08-12 重构:实现合并到 CodeLoginForm(accountType='phone'),本文件保留导出 API。
import { CodeLoginForm } from './code-login-form'
import type { LoginApiClient, LoginResult } from './types'

export type { CodeLoginFormProps } from './code-login-form'

export interface PhoneCodeLoginFormProps {
  /** i18n 翻译函数 */
  t: (key: string, params?: Record<string, string | number>) => string
  /** 登录 API 客户端 */
  apiClient: LoginApiClient
  /** 登录成功回调 */
  onSuccess?: (result: LoginResult) => void | Promise<void>
  /** 协议状态 */
  agreed?: boolean
  onAgreedChange?: (v: boolean) => void
  /** 未勾选协议时调用 */
  onRequireAgree?: () => void
  showAgreeErr?: boolean
  /** 自定义样式 */
  inputClassName?: string
  buttonClassName?: string
  /** 是否启用账号历史持久化 */
  enableCredentialPersistence?: boolean
}

export function PhoneCodeLoginForm(props: PhoneCodeLoginFormProps) {
  return <CodeLoginForm accountType="phone" {...props} />
}
