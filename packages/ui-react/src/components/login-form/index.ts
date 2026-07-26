/**
 * LoginForm 共享包统一导出(2026-07-26 立)
 *
 * web + extension 端都从这里 import:
 *   import { LoginForm, type LoginFormProps, type LoginApiClient, type ThirdPartyProvider } from '@ihui/ui-react'
 *
 * 包含:
 *   - LoginForm:统一登录表单主组件(4 tab + 三方 + 注册/忘记 + 协议)
 *   - PasswordLoginForm / EmailCodeLoginForm / PhoneCodeLoginForm / QrCodeLogin:子表单
 *   - ThirdPartyLoginButtons:第三方登录按钮群
 *   - AgreementCheckbox / AgreementNoticeDialog:协议复选框 + 协议弹窗
 *   - PasswordInput / OtpInput:密码输入框 / 验证码输入
 *   - Alert:错误提示
 *   - types:共享类型定义
 */
export { LoginForm } from './login-form'
export type { LoginFormProps } from './login-form'
export { PasswordLoginForm } from './password-tab'
export { EmailCodeLoginForm } from './email-code-tab'
export { PhoneCodeLoginForm } from './phone-code-tab'
export { QrCodeLogin } from './qr-tab'
export { ThirdPartyLoginButtons } from './third-party-buttons'
export { AgreementCheckbox } from './agreement-checkbox'
export { AgreementNoticeDialog } from './agreement-notice-dialog'
export { PasswordInput } from './password-input'
export { OtpInput } from './otp-input'
export { Alert } from './alert'
export type {
  LoginTab,
  ThirdPartyPlatform,
  LoginResult,
  LoginApiClient,
  ThirdPartyProvider,
  ThirdPartyConfig,
  TFunc,
} from './types'
