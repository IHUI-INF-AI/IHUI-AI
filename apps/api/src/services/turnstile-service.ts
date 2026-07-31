/**
 * Cloudflare Turnstile 人机验证服务。
 *
 * 职责:
 * 1. verifyTurnstile:服务端校验 Turnstile token(POST siteverify)
 * 2. getTurnstileConfig:返回前端配置(enabled + siteKey)
 * 3. isTurnstileEnabled:便捷判断
 *
 * 降级:TURNSTILE_SECRET_KEY 未配置时,verifyTurnstile 返回 { success: true }(开发环境放行)。
 * 环境变量:
 *  - TURNSTILE_SITE_KEY:前端渲染 widget 用(对应 NEXT_PUBLIC_TURNSTILE_SITE_KEY)
 *  - TURNSTILE_SECRET_KEY:后端 siteverify 用
 */

import { logger } from '../utils/logger.js'

/* -------------------------------------------------------------------------- */
/* 类型                                                                        */
/* -------------------------------------------------------------------------- */

export interface TurnstileVerifyResult {
  success: boolean
  /** Cloudflare 返回的错误码列表(如 ['invalid-input-secret']) */
  errorCodes?: string[]
}

export interface TurnstileConfig {
  /** siteKey 和 secretKey 都配置时为 true */
  enabled: boolean
  /** 前端渲染 widget 用的 siteKey,未配置时为 null */
  siteKey: string | null
}

/* -------------------------------------------------------------------------- */
/* 常量                                                                        */
/* -------------------------------------------------------------------------- */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const VERIFY_TIMEOUT_MS = 5_000

/* -------------------------------------------------------------------------- */
/* 服务实现                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 校验 Cloudflare Turnstile token。
 *
 * 调用 Cloudflare siteverify API,5 秒超时。
 * 未配置 TURNSTILE_SECRET_KEY 时降级返回 { success: true }(开发环境放行)。
 *
 * @param token    前端 Turnstile widget 回调返回的 token
 * @param remoteIp 客户端 IP(可选,传给 Cloudflare 辅助判断)
 */
export async function verifyTurnstile(
  token: string,
  remoteIp: string,
): Promise<TurnstileVerifyResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY

  // 未配置 secret → 开发环境放行
  if (!secretKey) {
    return { success: true }
  }

  if (!token) {
    return { success: false, errorCodes: ['missing-token'] }
  }

  try {
    const params = new URLSearchParams({
      secret: secretKey,
      response: token,
    })
    if (remoteIp) params.set('remoteip', remoteIp)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

    try {
      const resp = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        body: params,
        signal: controller.signal,
      })
      if (!resp.ok) {
        return { success: false, errorCodes: [`http-${resp.status}`] }
      }
      const data = (await resp.json()) as {
        success?: boolean
        'error-codes'?: string[]
      }
      return {
        success: data.success === true,
        errorCodes:
          data['error-codes'] && data['error-codes'].length > 0
            ? data['error-codes']
            : undefined,
      }
    } finally {
      clearTimeout(timer)
    }
  } catch (e) {
    logger.warn('turnstile: siteverify failed', { err: e })
    return { success: false, errorCodes: ['verify-exception'] }
  }
}

/**
 * 获取 Turnstile 前端配置。
 *
 * enabled = TURNSTILE_SITE_KEY && TURNSTILE_SECRET_KEY 都配置。
 * siteKey = TURNSTILE_SITE_KEY(前端用此值渲染 widget)。
 */
export function getTurnstileConfig(): TurnstileConfig {
  const siteKey = process.env.TURNSTILE_SITE_KEY ?? null
  const secretKey = process.env.TURNSTILE_SECRET_KEY
  return {
    enabled: !!siteKey && !!secretKey,
    siteKey,
  }
}

/** 便捷判断 Turnstile 是否启用(siteKey + secretKey 都配置)。 */
export function isTurnstileEnabled(): boolean {
  return getTurnstileConfig().enabled
}
