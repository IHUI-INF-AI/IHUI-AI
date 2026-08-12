'use client'

// 2026-08-12 重构:实现合并到 RegisterAccountForm(accountType='email'),本文件保留导出 API。
import { RegisterAccountForm } from './RegisterAccountForm'

export type { RegisterAccountFormProps } from './RegisterAccountForm'

export interface EmailRegisterFormProps {
  onSuccess?: () => void
  agreed: boolean
  onAgreedChange: (v: boolean) => void
  showAgreeErr: boolean
  setShowAgreeErr: (v: boolean) => void
}

export function EmailRegisterForm(props: EmailRegisterFormProps) {
  return <RegisterAccountForm accountType="email" {...props} />
}
