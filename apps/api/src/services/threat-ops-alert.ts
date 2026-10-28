// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运行时威胁事件 → 管理员告警。
 *
 * 补的是一格真实盲区:threat-detector 自动封禁/高危只写 `logger.warn`,
 * 而登录异常通知的收件人是**登录用户本人** —— 于是"正在被人打"这件事
 * 只有人主动去读 /security 才知情。本文件把封禁与高危升级接到
 * `alert-notification-service` 的既有出口(不新开第二套 SMTP,§0.6/§5e)。
 *
 * 风暴控制:节流身份 = 类别(block/watch)这一个稳定语义,窗口内后续同类事件
 * 只累加计数、不再发信,下次开窗时把抑制数带进正文(§5e-1:不按会抖的明细去重,
 * 也绝不设每日总量上限 —— 撞顶就是静默丢投递)。
 */

import type { Redis } from 'ioredis'
import { logger } from '../utils/logger.js'
import { pushAlertWithResult } from './alert-notification-service.js'

/** 告警类别(同时充当节流身份) */
export type ThreatAlertKind = 'block' | 'watch'

/** 各类别的节流窗口(秒):封禁 15 分钟,高危监控 6 小时 */
const THROTTLE_WINDOWS: Record<ThreatAlertKind, number> = {
  block: 15 * 60,
  watch: 6 * 60 * 60,
}

const KEY_PREFIX = 'ihui:threat-alert:'

export interface BlockAlertInput {
  ip: string
  score: number
  durationLabel: string
  reasons: string[]
  badEvents: number
  /** 插件侧的近期封禁快照(最多 20 条),只取前若干条进正文 */
  recentBlocks?: Array<{ ip: string; score: number; duration: string; timestamp: number }>
}

export interface WatchAlertInput {
  ip: string
  score: number
  reasons: string[]
  path: string
  /** 当前处于监控中的 IP 总数 */
  watchedCount: number
}

export interface ThrottleWindow {
  /** send=本次抢到开窗权;throttled=窗口内同类事件,只计数 */
  outcome: 'send' | 'throttled'
  /** 开窗时带出的"上一窗口被抑制的同类事件数" */
  suppressed: number
}

/* 无 Redis 时的进程内回落(单实例等效) */
export interface ThrottleMemory {
  gateUntil: Map<ThreatAlertKind, number>
  pending: Map<ThreatAlertKind, number>
}

const defaultMemory: ThrottleMemory = { gateUntil: new Map(), pending: new Map() }

/**
 * 抢占节流窗口。Redis 不可用 ⇒ 回落进程内(失效方向是"照发一封",不是静默;
 * 与 scheduler-worker 的 ai-feed 冷却同一条判序:判不出就照送,绝不冒充"已报过")。
 */
export async function acquireThrottleWindow(
  kind: ThreatAlertKind,
  redis: Redis | null,
  nowMs = Date.now(),
  memory: ThrottleMemory = defaultMemory,
): Promise<ThrottleWindow> {
  const windowSec = THROTTLE_WINDOWS[kind]

  if (redis) {
    try {
      const gateKey = `${KEY_PREFIX}${kind}:gate`
      const pendingKey = `${KEY_PREFIX}${kind}:pending`
      const acquired = await redis.set(gateKey, '1', 'EX', windowSec, 'NX')
      if (acquired !== 'OK') {
        const n = await redis.incr(pendingKey)
        if (n === 1) await redis.expire(pendingKey, windowSec * 2)
        return { outcome: 'throttled', suppressed: 0 }
      }
      const raw = await redis.get(pendingKey)
      await redis.del(pendingKey)
      return { outcome: 'send', suppressed: Number.parseInt(raw ?? '0', 10) || 0 }
    } catch (e) {
      logger.warn('threat-alert: redis 节流不可用,回落进程内窗口', {
        err: e instanceof Error ? e.message : String(e),
        kind,
      })
    }
  }

  const gateUntil = memory.gateUntil.get(kind) ?? 0
  if (nowMs < gateUntil) {
    memory.pending.set(kind, (memory.pending.get(kind) ?? 0) + 1)
    return { outcome: 'throttled', suppressed: 0 }
  }
  memory.gateUntil.set(kind, nowMs + windowSec * 1000)
  const suppressed = memory.pending.get(kind) ?? 0
  memory.pending.delete(kind)
  return { outcome: 'send', suppressed }
}

const timeFmt = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

const fmtTime = (ms: number): string => timeFmt.format(new Date(ms))

/** 封禁告警正文(纯函数,镜像测试直接钉) */
export function buildBlockMessage(
  input: BlockAlertInput,
  suppressed: number,
  atMs: number,
): string {
  const lines = [
    `来源:运行时威胁检测(threat-detector)`,
    `时刻:${fmtTime(atMs)}`,
    `动作:已自动封禁 IP ${input.ip}(信誉评分 ${input.score},阈值 80)`,
    `封禁时长:${input.durationLabel}`,
    `累计恶意事件:${input.badEvents}`,
    `触发原因:${input.reasons.length > 0 ? input.reasons.join('、') : '未记录'}`,
  ]
  if (suppressed > 0) {
    lines.push(`上一窗口内另有 ${suppressed} 次同类封禁未单独通报`)
  }
  const recent = (input.recentBlocks ?? []).slice(0, 5)
  if (recent.length > 0) {
    lines.push('最近封禁:')
    for (const r of recent) {
      lines.push(`  ${r.ip} · 评分 ${r.score} · ${r.duration} · ${fmtTime(r.timestamp)}`)
    }
  }
  return lines.join('\n')
}

/** 高危监控告警正文 */
export function buildWatchMessage(
  input: WatchAlertInput,
  suppressed: number,
  atMs: number,
): string {
  const lines = [
    `来源:运行时威胁检测(threat-detector)`,
    `时刻:${fmtTime(atMs)}`,
    `状态:高危 IP 正在监控中(评分 ${input.score},未达封禁阈值 80)`,
    `IP:${input.ip}`,
    `最新命中路径:${input.path}`,
    `触发原因:${input.reasons.length > 0 ? input.reasons.join('、') : '未记录'}`,
    `当前监控中的 IP 总数:${input.watchedCount}`,
  ]
  if (suppressed > 0) {
    lines.push(`上一窗口内另有 ${suppressed} 次同类高危命中未单独通报`)
  }
  return lines.join('\n')
}

/** 送达判定:全渠道未落地必须喊响,不允许"以为寄了" (§5e) */
async function deliver(
  title: string,
  message: string,
  severity: 'warning' | 'critical',
): Promise<void> {
  const result = await pushAlertWithResult({
    title,
    message,
    severity,
    source: 'threat-detector',
  })
  const landed = Object.values(result).some((ok) => ok === true)
  if (!landed) {
    logger.warn('threat-alert: 威胁告警未送达任何渠道(检查 ALERT_EMAIL_TO / SMTP_* 配置)', {
      channels: result,
      title,
    })
  }
}

export async function notifyThreatBlock(
  redis: Redis | null,
  input: BlockAlertInput,
  atMs = Date.now(),
  memory: ThrottleMemory = defaultMemory,
): Promise<ThrottleWindow> {
  const win = await acquireThrottleWindow('block', redis, atMs, memory)
  if (win.outcome === 'throttled') return win
  await deliver(
    `运行时威胁:已自动封禁 ${input.ip}`,
    buildBlockMessage(input, win.suppressed, atMs),
    'critical',
  )
  return win
}

export async function notifyThreatWatch(
  redis: Redis | null,
  input: WatchAlertInput,
  atMs = Date.now(),
  memory: ThrottleMemory = defaultMemory,
): Promise<ThrottleWindow> {
  const win = await acquireThrottleWindow('watch', redis, atMs, memory)
  if (win.outcome === 'throttled') return win
  await deliver(
    `运行时威胁:高危 IP ${input.ip} 正在被监控`,
    buildWatchMessage(input, win.suppressed, atMs),
    'warning',
  )
  return win
}

export const __test__ = {
  THROTTLE_WINDOWS,
  KEY_PREFIX,
  acquireThrottleWindow,
  buildBlockMessage,
  buildWatchMessage,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
