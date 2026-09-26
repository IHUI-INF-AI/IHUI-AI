// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 耗时样本唯一出口(格②,2026-09-26 立)。
 *
 * 为什么:裸 `Date.now() - startedAt` 会被 NTP 步进 / 系统休眠 / 容器时钟漂移打穿——
 * 差值可以是负数或巨大值,而它直接决定熔断开合(relay-channel-router.recordChannelResult)
 * 与统计落库(ai-capability-discovery 的 avgLatencyMs、clawdbot/analytics 的 avg/p95)。
 *
 * 规矩:
 * - 测量一律用单调钟 performance.now();
 * - 墙钟 Date.now() 只做交叉校验:|单调 − 墙钟| > 容差 ⇒ 样本**不可信**;
 * - 任一差值为负一律不可信;
 * - 不可信样本:**计数**(elapsedClockStats 观测面可回答"标了几条"),不静默丢,
 *   并且**不喂熔断/统计**(消费者据 trustworthy / elapsedMs=null 跳过)。
 *
 * 禁止再在端内各处写第四把 `Date.now()-x`——新的耗时消费点一律走这个出口。
 */
import { performance } from 'node:perf_hooks'

export type UntrustworthyReason = 'negative-delta' | 'clock-divergence'

export interface ElapsedSample {
  /** 单调钟差值(ms);不可信时保留原值仅供观测,不得当耗时结论消费 */
  readonly perfMs: number
  /** 墙钟差值(ms),仅用于交叉校验,永不作为耗时结论 */
  readonly wallMs: number
  readonly trustworthy: boolean
  /** 可信 ⇒ 等于 perfMs(与旧 `Date.now()-start` 同量级);不可信 ⇒ null(消费者必须喂 null/跳过,不得用 perfMs) */
  readonly elapsedMs: number | null
  readonly reason: UntrustworthyReason | null
}

export interface ClockSource {
  perfNow(): number
  wallNow(): number
}

const defaultClocks: ClockSource = {
  perfNow: () => performance.now(),
  wallNow: () => Date.now(),
}

/**
 * 单调钟与墙钟分歧容差(ms)。
 * 依据:两者正常同为实时前进,NTP slew(渐进校正)对小时级请求的累计分歧在亚秒级;
 * 而 NTP step / 休眠 / 容器迁移是秒级到小时级的跳变 —— 2s 远高于噪声地板、低于故障量级。
 */
export const CLOCK_DIVERGENCE_TOLERANCE_MS = 2000

export interface Stopwatch {
  stop(): ElapsedSample
}

export interface StartStopwatchOptions {
  /** 测试注入口:假时钟(生产默认走真实 单调+墙钟 双钟) */
  clocks?: ClockSource
  divergenceToleranceMs?: number
}

interface ClockQualityCounters {
  total: number
  trustworthy: number
  untrustworthy: number
  negativeDelta: number
  divergence: number
}

const counters: ClockQualityCounters = {
  total: 0,
  trustworthy: 0,
  untrustworthy: 0,
  negativeDelta: 0,
  divergence: 0,
}

export type ElapsedClockStats = Readonly<ClockQualityCounters>

/** 观测面:被交叉校验标掉的样本计数(不得静默丢——排查时要能当场回答,而不是靠猜)。 */
export function elapsedClockStats(): ElapsedClockStats {
  return { ...counters }
}

/** 起表:到达处 `stop()` 产出经 单调钟 × 墙钟 交叉校验的耗时样本。 */
export function startStopwatch(opts: StartStopwatchOptions = {}): Stopwatch {
  const clocks = opts.clocks ?? defaultClocks
  const tolerance = opts.divergenceToleranceMs ?? CLOCK_DIVERGENCE_TOLERANCE_MS
  const perf0 = clocks.perfNow()
  const wall0 = clocks.wallNow()
  return {
    stop(): ElapsedSample {
      const perfMs = clocks.perfNow() - perf0
      const wallMs = clocks.wallNow() - wall0
      counters.total += 1
      let reason: UntrustworthyReason | null = null
      if (perfMs < 0 || wallMs < 0) {
        reason = 'negative-delta'
        counters.negativeDelta += 1
      } else if (Math.abs(perfMs - wallMs) > tolerance) {
        reason = 'clock-divergence'
        counters.divergence += 1
      }
      const trustworthy = reason === null
      if (trustworthy) counters.trustworthy += 1
      else counters.untrustworthy += 1
      return {
        perfMs,
        wallMs,
        trustworthy,
        elapsedMs: trustworthy ? perfMs : null,
        reason,
      }
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
