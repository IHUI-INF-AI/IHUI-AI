/**
 * 记住密码 + 账号历史 + 自动登录 凭据管理
 *
 * 2026-07-30 重构:核心函数抽到 packages/ui-react/src/lib/remember-credentials.ts,
 * 本文件仅 re-export + 保留 web 端特有的 credentialStorage 对象(供
 * `@ihui/shared/hooks` 的 useLoginForm 注入使用,实现 CredentialStorage 接口)。
 */

import type { CredentialStorage } from '@ihui/shared/hooks'
import {
  saveRememberedCredentials,
  loadRememberedCredentials,
  clearRememberedCredentials,
  saveAutoLogin,
  loadAutoLogin,
  clearAutoLogin,
  saveLoginHistory,
  loadLoginHistory,
  clearLoginHistory,
  removeFromLoginHistory,
  type RememberedCredentials,
} from '@ihui/ui-react'

export {
  saveRememberedCredentials,
  loadRememberedCredentials,
  clearRememberedCredentials,
  saveAutoLogin,
  loadAutoLogin,
  clearAutoLogin,
  saveLoginHistory,
  loadLoginHistory,
  clearLoginHistory,
  removeFromLoginHistory,
  type RememberedCredentials,
}

/* ========== 跨端共享 storage 接口实现(2026-07-29) ========== */
//
// 包装共享包函数式 API 为 `CredentialStorage` 接口对象,供
// `@ihui/shared/hooks` 的 `useLoginForm({ storage })` 注入使用。

export const credentialStorage: CredentialStorage = {
  loadRemembered: loadRememberedCredentials,
  saveRemembered: saveRememberedCredentials,
  clearRemembered: clearRememberedCredentials,
  loadAutoLogin,
  saveAutoLogin,
  clearAutoLogin,
  saveLoginHistory,
}
