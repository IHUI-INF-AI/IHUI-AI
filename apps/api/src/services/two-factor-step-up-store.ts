// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { Redis } from 'ioredis'
import { findUserById } from '../db/queries.js'
import { logger } from '../utils/logger.js'

/**
 * 2FA step-up（敏感动作二次验证）的新鲜度账。
 *
 * 补的那一格:TOTP 目前只在**登录**时问一次；会话令牌被窃后，提现这类动作不再需要第二个
 * 因子。这里不管密码学校验（仍由 `/auth/2fa/step-up` 复用既有 verifyTotp 出口做），
 * 只管"最近验过没有"这一份状态 —— 判据单源，供各高敏端点共用(§0.6)。
 *
 * 生效范围刻意收窄：**只有已开 2FA 的账号**被要求（未开的账号行为逐字不变，不打断存量用户）。
 * 失效方向：取不到账号状态 / 存储两层都判不出 ⇒ 一律判"不新鲜"并拒。资金动作上
 * 「多要一次定向验证」永远优于「多放一次跳转」(§0.10)。
 */

/** step-up 有效窗(秒)：验过一次后，窗内同类高敏动作不再重复要码 */
export const STEP_UP_WINDOW_SEC = 300

const keyOf = (userId: string): string => `ihui:2fa:stepup:${userId}`

/** 无 Redis 时的进程内回落（单实例等效；多实例各记一份，宁可多要一次码） */
const memFreshUntil = new Map<string, number>()

export async function recordTwoFactorStepUp(
  userId: string,
  redis: Redis | null,
  ttlSec: number = STEP_UP_WINDOW_SEC,
  nowMs: number = Date.now(),
): Promise<void> {
  memFreshUntil.set(userId, nowMs + ttlSec * 1000)
  if (!redis) return
  try {
    await redis.set(keyOf(userId), '1', 'EX', ttlSec)
  } catch (e) {
    logger.warn('step-up: redis 记账失败，已回落进程内窗口', {
      err: e instanceof Error ? e.message : String(e),
    })
  }
}

export async function isTwoFactorStepUpFresh(
  userId: string,
  redis: Redis | null,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (redis) {
    try {
      const v = await redis.get(keyOf(userId))
      if (v === '1') return true
      // Redis 里没有 ⇒ 仍看进程内一层（Redis 刚抖动/键被清时不至于把刚验过的用户打回）
    } catch (e) {
      logger.warn('step-up: redis 查询失败，改判进程内窗口', {
        err: e instanceof Error ? e.message : String(e),
      })
    }
  }
  const until = memFreshUntil.get(userId) ?? 0
  if (until <= nowMs) {
    if (until !== 0) memFreshUntil.delete(userId)
    return false
  }
  return true
}

export async function revokeTwoFactorStepUp(userId: string, redis: Redis | null): Promise<void> {
  memFreshUntil.delete(userId)
  if (!redis) return
  try {
    await redis.del(keyOf(userId))
  } catch (e) {
    logger.warn('step-up: redis 撤销失败（进程内已清）', {
      err: e instanceof Error ? e.message : String(e),
    })
  }
}

export type StepUpGateOutcome =
  | { ok: true; enforced: false }
  | { ok: true; enforced: true }
  | { ok: false; code: 'STEP_UP_REQUIRED' | 'ACCOUNT_UNJUDGED' }

/**
 * 高敏端点的共用闸：账号未开 2FA ⇒ 直接放行（`enforced:false`，存量行为不变）；
 * 开了 2FA ⇒ 必须有窗内验证。查不到账号状态一律拒（不当成"没开 2FA"放过）。
 */
export async function requireStepUpForTwoFactorUser(params: {
  userId: string
  redis: Redis | null
  nowMs?: number
}): Promise<StepUpGateOutcome> {
  let twoFactorEnabled: boolean
  try {
    const user = await findUserById(params.userId)
    if (!user) return { ok: false, code: 'ACCOUNT_UNJUDGED' }
    twoFactorEnabled = user.twoFactorEnabled === true
  } catch (e) {
    logger.warn('step-up: 账号 2FA 状态读不出，按需要验证处理（不默认放行）', {
      err: e instanceof Error ? e.message : String(e),
    })
    return { ok: false, code: 'ACCOUNT_UNJUDGED' }
  }
  if (!twoFactorEnabled) return { ok: true, enforced: false }
  const fresh = await isTwoFactorStepUpFresh(params.userId, params.redis, params.nowMs)
  if (!fresh) return { ok: false, code: 'STEP_UP_REQUIRED' }
  return { ok: true, enforced: true }
}

export const __test__ = {
  STEP_UP_WINDOW_SEC,
  keyOf,
  recordTwoFactorStepUp,
  isTwoFactorStepUpFresh,
  revokeTwoFactorStepUp,
  requireStepUpForTwoFactorUser,
  memFreshUntil,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
