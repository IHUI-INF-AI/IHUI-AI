/**
 * LoginForm 组件统一出口(2026-07-26 立)
 *
 * 单一来源(single source of truth):web 端 LoginFormContent 和扩展端
 * popup/sidepanel 都从 @ihui/ui-react 导入这套 API。
 */
export { LoginForm } from './login-form'
export { PasswordLoginForm } from './password-login-form'
export { EmailCodeLoginForm } from './email-code-login-form'
export { PhoneCodeLoginForm } from './phone-code-login-form'
export { QrTab } from './qr-tab'
export { ThirdPartyLoginButtons } from './third-party-login-buttons'
export { AgreementCheckbox } from './agreement-checkbox'
export { AgreementNoticeDialog } from './agreement-notice-dialog'

export type { LoginFormProps, LoginApiClient, LoginResult, LoginTab, ThirdPartyPlatform, ThirdPartyProvider, ThirdPartyConfig, QrPlatformConfig } from './types'
export { ALL_THIRD_PARTY_PLATFORMS, isValidEmail, isValidPhone } from './types'

export type { PasswordLoginFormProps } from './password-login-form'
export type { EmailCodeLoginFormProps } from './email-code-login-form'
export type { PhoneCodeLoginFormProps } from './phone-code-login-form'
export type { QrTabProps } from './qr-tab'
export type { ThirdPartyLoginButtonsProps } from './third-party-login-buttons'
export type { AgreementCheckboxProps } from './agreement-checkbox'
export type { AgreementNoticeDialogProps } from './agreement-notice-dialog'
