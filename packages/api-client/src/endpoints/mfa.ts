// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MFA 端点(2026-11-05 立,门 300 存量裁决 A 类:web / RN 端内直拼 `/api/mfa` 收口)。
 *
 * 后端真值:`apps/api/src/routes/mfa.ts`(index.ts:1303 以 `/api/mfa` 前缀注册)。
 * GET /status、POST /setup、/enable、/disable、/recovery-codes;401/续期/超时由共享 client 统一处理。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** GET /api/mfa/status 的载荷(`enabledAt` 可为 null,`backupCodesRemaining` 为剩余恢复码数)。 */
export interface MfaStatusData {
  enabled: boolean
  enabledAt: string | null
  backupCodesRemaining: number
}

/** POST /api/mfa/setup 的载荷(TOTP secret + 二维码 URI / dataURL)。 */
export interface MfaSetupData {
  secret: string
  qrUri: string
  qrDataUrl: string
}

/** POST /api/mfa/enable 的入参。 */
export interface MfaEnableInput {
  secret: string
  token: string
}

/** POST /api/mfa/enable 的载荷(恢复码明文只返回这一次)。 */
export interface MfaEnableData {
  enabled: boolean
  recoveryCodes: string[]
}

/** POST /api/mfa/recovery-codes 的载荷(恢复码明文只返回这一次)。 */
export interface MfaRecoveryCodesData {
  recoveryCodes: string[]
}

/** POST /api/mfa/disable 的入参(后端要求当前密码二次确认)。 */
export interface MfaDisableInput {
  password: string
}

/** POST /api/mfa/disable 的载荷。 */
export interface MfaDisableData {
  enabled: boolean
}

/** GET /api/mfa/status —— 查询当前 MFA 状态。 */
export async function getMfaStatus(): Promise<ApiResult<MfaStatusData>> {
  return fetchApi<MfaStatusData>('/api/mfa/status')
}

/** POST /api/mfa/setup —— 生成 secret 与二维码(启用前)。 */
export async function setupMfa(): Promise<ApiResult<MfaSetupData>> {
  return fetchApi<MfaSetupData>('/api/mfa/setup', { method: 'POST' })
}

/** POST /api/mfa/enable —— 校验首个 TOTP 后启用,返回恢复码。 */
export async function enableMfa(input: MfaEnableInput): Promise<ApiResult<MfaEnableData>> {
  return fetchApi<MfaEnableData>('/api/mfa/enable', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** POST /api/mfa/recovery-codes —— 重新生成恢复码(两个端均以 POST 调用)。 */
export async function getMfaRecoveryCodes(): Promise<ApiResult<MfaRecoveryCodesData>> {
  return fetchApi<MfaRecoveryCodesData>('/api/mfa/recovery-codes', { method: 'POST' })
}

/** POST /api/mfa/disable —— 校验密码后禁用 MFA。 */
export async function disableMfa(input?: MfaDisableInput): Promise<ApiResult<MfaDisableData>> {
  return fetchApi<MfaDisableData>('/api/mfa/disable', {
    method: 'POST',
    body: JSON.stringify(input ?? {}),
  })
}
