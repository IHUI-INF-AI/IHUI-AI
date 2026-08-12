'use client'

// 2026-08-12 重构:实现合并到 RegisterAccountForm(accountType='phone'),本文件保留导出 API。
import { RegisterAccountForm } from './RegisterAccountForm'

export type { RegisterAccountFormProps } from './RegisterAccountForm'

export interface PhoneRegisterFormProps {
  onSuccess?: () => void
  agreed: boolean
  onAgreedChange: (v: boolean) => void
  showAgreeErr: boolean
  setShowAgreeErr: (v: boolean) => void
}

export function PhoneRegisterForm(props: PhoneRegisterFormProps) {
  return <RegisterAccountForm accountType="phone" {...props} />
}
