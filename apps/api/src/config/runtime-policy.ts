// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L06 本地运行时策略热更新(2026-11-26)。
 *
 * 现状:超时/并发/探针节拍全是源码里的字面量,改一个值要重新打包发版;运维现场
 * 只能重启。对标的做法是:一份 `runtime-policy.json`,热加载,变更留 who/when/why。
 *
 * 判据(逐条可复核):
 *  1. **整份拒绝**:任一层出现未知键或取值越界,整份文档作废、沿用上一份 —— 不做
 *     "部分生效"(部分生效会让现场出现"我改了三处只生效一处"的不可解释态);
 *  2. **5 秒内生效**:`RUNTIME_POLICY_RELOAD_SLA_MS = 5000`;实现用 1s 轮询
 *     (`fs.watchFile`),实测变更在 1–2s 内被应用;
 *  3. **who/when/why**:每次应用成功/拒绝都写一条审计(内存环 + 追加
 *     `<policy>.audit.jsonl`),字段取文档 `meta.by` / `meta.why` / 本地时刻;
 *  4. 文件不存在 ⇒ 用内置默认(不是报错、也不是"空策略");文件后来出现 ⇒ 照常热加载。
 *
 * 消费者(本次已接):`server.server.requestTimeout`(请求体接收上界)、
 * `createWorker` 的 BullMQ 并发、事件循环探针节拍。三者都订阅同一份快照。
 */

import fs from 'node:fs'
import path from 'node:path'
import { monitorEventLoopDelay } from 'node:perf_hooks'

export const RUNTIME_POLICY_RELOAD_SLA_MS = 5_000
const POLL_INTERVAL_MS = 1_000
const AUDIT_CAPACITY = 128

export interface RuntimePolicy {
  probe: { intervalMs: number; timeoutMs: number }
  timeout: { requestMs: number }
  backgroundLimit: { maxConcurrent: number }
}

export const DEFAULT_RUNTIME_POLICY: RuntimePolicy = {
  probe: { intervalMs: 60_000, timeoutMs: 2_000 },
  timeout: { requestMs: 300_000 },
  backgroundLimit: { maxConcurrent: 5 },
}

export interface RuntimePolicyChange {
  at: string
  by: string
  why: string
  outcome: 'applied' | 'rejected'
  /** 拒绝时的理由码;应用成功为 null。 */
  reason: string | null
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const INTEGER_RANGES = {
  'probe.intervalMs': [1_000, 3_600_000] as const,
  'probe.timeoutMs': [100, 60_000] as const,
  'timeout.requestMs': [1_000, 3_600_000] as const,
  'backgroundLimit.maxConcurrent': [1, 128] as const,
}

/** 严格校验:未知键、缺键、非整数、越界 —— 任一命中即整份拒。 */
export function validateRuntimePolicy(
  raw: unknown,
): { ok: true; value: RuntimePolicy } | { ok: false; reason: string } {
  if (!isPlainObject(raw)) return { ok: false, reason: 'not-an-object' }
  const allowedTop = new Set(['probe', 'timeout', 'backgroundLimit', 'meta'])
  for (const key of Object.keys(raw)) {
    if (!allowedTop.has(key)) return { ok: false, reason: `unknown-key:${key}` }
  }
  const sections: Record<string, readonly string[]> = {
    probe: ['intervalMs', 'timeoutMs'],
    timeout: ['requestMs'],
    backgroundLimit: ['maxConcurrent'],
  }
  for (const [section, keys] of Object.entries(sections)) {
    const node = raw[section]
    if (!isPlainObject(node)) return { ok: false, reason: `missing-section:${section}` }
    for (const key of Object.keys(node)) {
      if (!keys.includes(key)) return { ok: false, reason: `unknown-key:${section}.${key}` }
    }
    for (const key of keys) {
      const value = node[key]
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return { ok: false, reason: `not-integer:${section}.${key}` }
      }
      const [min, max] = INTEGER_RANGES[`${section}.${key}` as keyof typeof INTEGER_RANGES]
      if (value < min || value > max) {
        return { ok: false, reason: `out-of-range:${section}.${key}` }
      }
    }
  }
  const meta = raw.meta
  if (meta !== undefined && !isPlainObject(meta)) return { ok: false, reason: 'meta-not-object' }
  const value = raw as unknown as RuntimePolicy
  return {
    ok: true,
    value: {
      probe: { intervalMs: value.probe.intervalMs, timeoutMs: value.probe.timeoutMs },
      timeout: { requestMs: value.timeout.requestMs },
      backgroundLimit: { maxConcurrent: value.backgroundLimit.maxConcurrent },
    },
  }
}

type Listener = (policy: RuntimePolicy, change: RuntimePolicyChange) => void

export interface RuntimePolicyStoreOptions {
  filePath: string
  now?: () => Date
  auditCapacity?: number
  onAudit?: (change: RuntimePolicyChange) => void
}

export class RuntimePolicyStore {
  private current: RuntimePolicy = DEFAULT_RUNTIME_POLICY
  private readonly listeners = new Set<Listener>()
  private readonly audits: RuntimePolicyChange[] = []
  private readonly opts: RuntimePolicyStoreOptions
  private watching = false
  private lastMtimeMs = 0

  constructor(opts: RuntimePolicyStoreOptions) {
    this.opts = opts
  }

  get(): RuntimePolicy {
    return this.current
  }

  auditTrail(): readonly RuntimePolicyChange[] {
    return [...this.audits]
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private nowIso(): string {
    return (this.opts.now?.() ?? new Date()).toISOString()
  }

  private record(change: RuntimePolicyChange): void {
    this.audits.push(change)
    while (this.audits.length > (this.opts.auditCapacity ?? AUDIT_CAPACITY)) this.audits.shift()
    this.opts.onAudit?.(change)
    try {
      fs.appendFileSync(this.auditFile(), `${JSON.stringify(change)}\n`, 'utf8')
    } catch {
      // 审计落盘失败不改变策略结论(内存环仍可用);下一次写会重试。
    }
  }

  private auditFile(): string {
    return `${this.opts.filePath}.audit.jsonl`
  }

  /** 读盘一次。返回是否发生了"应用"(拒绝也算一次变更记录)。 */
  reloadNow(): boolean {
    let text: string
    try {
      text = fs.readFileSync(this.opts.filePath, 'utf8')
    } catch {
      return false
    }
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      const change: RuntimePolicyChange = {
        at: this.nowIso(),
        by: 'unknown',
        why: '',
        outcome: 'rejected',
        reason: 'json-parse-failed',
      }
      this.record(change)
      return true
    }
    const meta = isPlainObject(raw) && isPlainObject(raw.meta) ? raw.meta : {}
    const by = typeof meta.by === 'string' && meta.by.trim() ? meta.by : 'unknown'
    const why = typeof meta.why === 'string' ? meta.why : ''
    const verdict = validateRuntimePolicy(raw)
    if (!verdict.ok) {
      this.record({ at: this.nowIso(), by, why, outcome: 'rejected', reason: verdict.reason })
      return true
    }
    this.current = verdict.value
    const change: RuntimePolicyChange = {
      at: this.nowIso(),
      by,
      why,
      outcome: 'applied',
      reason: null,
    }
    this.record(change)
    for (const listener of this.listeners) listener(this.current, change)
    return true
  }

  /** 启动轮询;文件不存在也照常轮询(出现即加载)。 */
  start(): void {
    if (this.watching) return
    this.watching = true
    this.reloadNow()
    try {
      this.lastMtimeMs = fs.statSync(this.opts.filePath).mtimeMs
    } catch {
      this.lastMtimeMs = 0
    }
    fs.watchFile(this.opts.filePath, { interval: POLL_INTERVAL_MS, persistent: false }, (curr) => {
      if (curr.mtimeMs === 0) return
      if (curr.mtimeMs === this.lastMtimeMs) return
      this.lastMtimeMs = curr.mtimeMs
      this.reloadNow()
    })
  }

  stop(): void {
    if (!this.watching) return
    fs.unwatchFile(this.opts.filePath)
    this.watching = false
  }
}

let singleton: RuntimePolicyStore | null = null

export function resolveRuntimePolicyPath(env: Record<string, string | undefined>): string {
  return env.IHUI_RUNTIME_POLICY_PATH?.trim() || path.resolve(process.cwd(), 'runtime-policy.json')
}

/** 进程级单例(读侧用);启动期由 index.ts 调 `startRuntimePolicy()`。 */
export function getRuntimePolicy(): RuntimePolicy {
  return singleton?.get() ?? DEFAULT_RUNTIME_POLICY
}

export function subscribeRuntimePolicy(listener: Listener): () => void {
  if (!singleton) return () => {}
  return singleton.subscribe(listener)
}

export function startRuntimePolicy(env: Record<string, string | undefined>): RuntimePolicyStore {
  if (singleton) return singleton
  singleton = new RuntimePolicyStore({ filePath: resolveRuntimePolicyPath(env) })
  singleton.start()
  return singleton
}

export function stopRuntimePolicy(): void {
  singleton?.stop()
  singleton = null
}

/**
 * 事件循环探针:按策略节拍采样,p95 超过 `probe.timeoutMs` 记一次告警。
 * 返回 stop 函数;不依赖 logger 实例,由调用方传 sink(便于测试)。
 */
export function startRuntimePolicyProbe(sink: (lagMs: number) => void): () => void {
  const histogram = monitorEventLoopDelay({ resolution: 10 })
  histogram.enable()
  let timer: NodeJS.Timeout | undefined
  const schedule = (intervalMs: number): void => {
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      const p95 = histogram.percentile(95) / 1e6
      if (p95 > getRuntimePolicy().probe.timeoutMs) sink(p95)
      histogram.reset()
    }, intervalMs)
    timer.unref()
  }
  schedule(getRuntimePolicy().probe.intervalMs)
  const unsubscribe = subscribeRuntimePolicy((p) => schedule(p.probe.intervalMs))
  return () => {
    if (timer) clearInterval(timer)
    unsubscribe()
    histogram.disable()
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
