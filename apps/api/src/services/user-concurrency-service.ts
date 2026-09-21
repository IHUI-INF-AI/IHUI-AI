// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 用户级并发限制服务(2026-09-16 立,第二批深度对标补强 H)。
 *
 * 背景:此前只有 Key 级 QPM(rateLimit)与 TPM(api-key-tpm-service),缺少
 * "同一用户同时挂起的请求数"上限——单用户开几十路并发会把号池瞬间打爆,
 * 竞品(Sub2API)默认 user_concurrency: 5。
 *
 * 实现:进程内 Map 计数。本仓生产为单实例(NSSM deployloop)部署,进程内
 * 状态正确;**多实例部署时必须迁移到 Redis**(与 relay-channel-router 的
 * 熔断状态同款 INCR/DECR 方案),接入点已在 tryAcquire/release 两函数收敛。
 *
 * 上限来源:环境变量 RELAY_USER_CONCURRENCY_LIMIT(默认 20)。
 * 语义:超限返回 429(可重试),非排队——与竞品行为一致。
 */
import { logger } from '../utils/logger.js'

const counters = new Map<string, number>()

const DEFAULT_LIMIT = 20

/** 用户并发上限(env RELAY_USER_CONCURRENCY_LIMIT,默认 20)。 */
export function getUserConcurrencyLimit(): number {
  const v = Number(process.env.RELAY_USER_CONCURRENCY_LIMIT)
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : DEFAULT_LIMIT
}

export interface ConcurrencySlotResult {
  ok: boolean
  current: number
  limit: number
}

/** 尝试占用一个并发槽;成功 current 已含本次。 */
export function tryAcquireUserConcurrency(userId: string): ConcurrencySlotResult {
  const limit = getUserConcurrencyLimit()
  const current = (counters.get(userId) ?? 0) + 1
  if (current > limit) {
    // 超限不占用,保持原计数(防止异常路径漏释放导致永久顶格)
    return { ok: false, current: current - 1, limit }
  }
  counters.set(userId, current)
  return { ok: true, current, limit }
}

/** 释放并发槽(连接 close 时调用);计数下探到 0 时清理键,防 Map 无限膨胀。 */
export function releaseUserConcurrency(userId: string): void {
  const current = (counters.get(userId) ?? 0) - 1
  if (current <= 0) {
    counters.delete(userId)
  } else {
    counters.set(userId, current)
  }
}

/** 读当前并发数(运维/诊断)。 */
export function getUserConcurrencyCurrent(userId: string): number {
  return counters.get(userId) ?? 0
}

// 防御性兜底:进程退出无法逐条释放,Map 随进程销毁,无需处理。
// 日志仅在首次超限时打(避免刷屏)由调用方 429 路径自带。
logger.debug('[user-concurrency] service loaded, limit env = RELAY_USER_CONCURRENCY_LIMIT')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
