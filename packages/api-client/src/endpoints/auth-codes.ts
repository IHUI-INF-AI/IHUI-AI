/**
 * 验证码相关 API(legacy /public-api/auth-code + /check 补开发,2 个端点)
 * 对应后端:apps/api/src/routes/auth-codes.ts(prefix: /api/auth-codes)
 * 公开端点,无鉴权(对齐 Java);验证码一次性,内存存储
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

// ===================== 类型定义 =====================

/** 验证码发送响应 */
export interface AuthCodeSentResult {
  mobile: string
  sent: boolean
  message: string
}

/** 验证码校验响应 */
export interface AuthCodeVerifyResult {
  valid: boolean
}

// ===================== 端点封装 =====================

/** 发送短信验证码 — GET /api/auth-codes?mobile= */
export async function sendAuthCode(mobile: string): Promise<ApiResult<AuthCodeSentResult>> {
  return fetchApi<AuthCodeSentResult>(`/api/auth-codes${buildQs({ mobile })}`)
}

/** 校验验证码(一次性) — POST /api/auth-codes/check */
export async function verifyAuthCode(input: {
  mobile: string
  code: string
}): Promise<ApiResult<AuthCodeVerifyResult>> {
  return fetchApi<AuthCodeVerifyResult>('/api/auth-codes/check', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
