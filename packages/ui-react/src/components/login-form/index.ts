// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
export { PasskeyLoginButton } from './passkey-login-button'
// 地区→登录方式优先级判据(2026-10-26 自 apps/web 迁入;消费方不得端内另写一份)
export { planLoginRegion, resolveLoginRegion, isOverseasLocale } from './region-policy'
// 平台优先序的执行器(图标网格与扫码渠道共用一份)
export { sortByPlatformPriority } from './third-party-login-buttons'
export type {
  LoginRegion,
  MaybeLoginRegion,
  LoginRegionPlan,
  LoginRegionPlanInput,
} from './region-policy'
// 账号输入框 + 历史下拉(2026-07-30 抽到共享包,消除 web 端 B 版本功能差异)
export { AccountHistoryInput } from './account-history-input'

export type {
  LoginFormProps,
  LoginApiClient,
  LoginResult,
  LoginTab,
  ThirdPartyPlatform,
  ThirdPartyProvider,
  ThirdPartyConfig,
  QrPlatformConfig,
  PasskeyAuthOptionsData,
} from './types'
export { ALL_THIRD_PARTY_PLATFORMS, isValidEmail, isValidPhone } from './types'

export type { PasswordLoginFormProps } from './password-login-form'
export type { EmailCodeLoginFormProps } from './email-code-login-form'
export type { PhoneCodeLoginFormProps } from './phone-code-login-form'
export type { QrTabProps } from './qr-tab'
export type { ThirdPartyLoginButtonsProps } from './third-party-login-buttons'
export type { AgreementCheckboxProps } from './agreement-checkbox'
export type { AgreementNoticeDialogProps } from './agreement-notice-dialog'
export type { PasskeyLoginButtonProps } from './passkey-login-button'
export type { AccountHistoryInputProps } from './account-history-input'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
