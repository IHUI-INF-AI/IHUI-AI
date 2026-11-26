// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { z } from 'zod'
import type { RecordAuditLogParams } from '../services/audit-log-service.js'

/**
 * RP-9 / L06 本地运行时策略热更新。
 *
 * 判据（docs/benchmark-evidence/2026-11/wave2-ihui-landing-v2-2026-11-26.md L06）:
 *   runtime-policy.json(probe/timeout/background_limit) + 热加载 + who/when/why 变更审计;
 *   非法字段整份拒绝并拒绝热加载;变更 5 秒内生效。
 *
 * 设计要点:
 *   1. schema 是 `.strict()` 闭集 —— 顶层与每一层嵌套出现未知字段,整份拒绝,不做部分应用;
 *   2. 审计元数据(changedBy/reason)是必填字段:没有 who/why 的变更不算合规格变更,
 *      when 取 changedAt → 文件 mtime → 当前时间,保证每条 applied 事件三元组齐全;
 *   3. 生效策略与审计事件是两步:先整份解析成功,再换 `current`;解析失败保留 last-known-good;
 *   4. 轮询间隔硬上限 4000ms(< 5s 验收线),注入值超限时截断而不是放宽;
 *   5. 同一内容不重复打点;审计 sink / 订阅者抛错被吞掉,不影响策略应用。
 *
 * 边界诚实声明:本模块交付磁盘→内存的策略加载、校验与审计事件;把事件写进 api
 * `audit_logs_chain` 需用 `toAuditLogParams()` 接 `recordAuditLog`,把策略值喂给各
 * 消费方需订阅 `subscribe()`,两者都是宿主接线,本票未实测真实运行期链路。
 */

export const RUNTIME_POLICY_FILENAME = 'runtime-policy.json'
export const DEFAULT_POLL_INTERVAL_MS = 1000
/** 5 秒验收线留 1 秒余量:任何注入值都不会让生效延迟超过 4 秒。 */
export const MAX_POLL_INTERVAL_MS = 4000

const boundedInt = (min: number, max: number) => z.number().int().min(min).max(max)
const singleLine = (max: number, label: string) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((v) => !/[\r\n]/.test(v), `${label} 不得含换行`)

const auditMetaSchema = z
  .object({
    changedBy: singleLine(200, 'changedBy'),
    reason: singleLine(500, 'reason'),
    changedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()

export const runtimePolicySchema = z
  .object({
    probe: z
      .object({
        enabled: z.boolean(),
        intervalMs: boundedInt(100, 60_000),
      })
      .strict(),
    timeout: z
      .object({
        commandMs: boundedInt(1_000, 600_000),
        approvalMs: boundedInt(1_000, 600_000),
      })
      .strict(),
    background_limit: z
      .object({
        maxTasks: boundedInt(1, 256),
        maxPerSession: boundedInt(1, 64),
      })
      .strict(),
    audit: auditMetaSchema,
  })
  .strict()

export type RuntimePolicy = z.infer<typeof runtimePolicySchema>
export type RuntimePolicyAuditMeta = z.infer<typeof auditMetaSchema>

/** 无策略文件/文件非法时的 fail-safe 取值:探针关、超时保守、后台任务收紧。 */
export const DEFAULT_RUNTIME_POLICY: Readonly<RuntimePolicy> = Object.freeze({
  probe: Object.freeze({ enabled: false, intervalMs: 1000 }),
  timeout: Object.freeze({ commandMs: 30_000, approvalMs: 60_000 }),
  background_limit: Object.freeze({ maxTasks: 8, maxPerSession: 2 }),
  audit: Object.freeze({ changedBy: 'system', reason: 'built-in fail-safe default' }),
})

export type RuntimePolicyRejectCode =
  | 'FILE_UNAVAILABLE'
  | 'EMPTY_CONTENT'
  | 'MALFORMED_JSON'
  | 'SCHEMA_REJECTED'

export type RuntimePolicyParseResult =
  | { ok: true; policy: RuntimePolicy; hash: string }
  | { ok: false; code: RuntimePolicyRejectCode; reasons: string[] }

export function contentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

function issuePaths(issues: readonly z.ZodIssue[]): string[] {
  return issues.map((issue) => {
    const path = ((issue as { path?: PropertyKey[] }).path ?? []).map(String)
    // zod 4 的 unrecognized_key issue 只把父对象放进 path,键名留在 message 里;
    // 补进路径,让审计 reasons 精确指出被拒字段(probe.surprise 而不是只有 probe)。
    const extra = /Unrecognized key:\s*"([^"]+)"/.exec(issue.message)?.[1]
    if (extra) path.push(extra)
    return `${path.length ? path.join('.') : '<root>'}: ${issue.message}`
  })
}

/** 整份解析:任何一处不合法都只返回拒绝结果,绝不返回半份策略。 */
export function parseRuntimePolicy(content: string): RuntimePolicyParseResult {
  if (!content.trim()) {
    return { ok: false, code: 'EMPTY_CONTENT', reasons: ['策略文件为空'] }
  }
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch (error) {
    return {
      ok: false,
      code: 'MALFORMED_JSON',
      reasons: [`JSON 解析失败: ${error instanceof Error ? error.message : String(error)}`],
    }
  }
  const parsed = runtimePolicySchema.safeParse(value)
  if (!parsed.success) {
    return { ok: false, code: 'SCHEMA_REJECTED', reasons: issuePaths(parsed.error.issues) }
  }
  return { ok: true, policy: parsed.data, hash: contentHash(content) }
}

/** who / when / why 三元组齐全的变更事件。审计事件不携带策略原文。 */
export interface RuntimePolicyAuditEvent {
  kind: 'applied' | 'rejected'
  who: string
  when: string
  why: string
  reasons: string[]
  previousHash: string | null
  nextHash: string | null
  policyFile: string
}

/** 纯函数:把变更事件映射为 api recordAuditLog 的落库参数(宿主自行 await 落库)。 */
export function toAuditLogParams(event: RuntimePolicyAuditEvent): RecordAuditLogParams {
  return {
    userId: event.who,
    action: `runtime_policy.${event.kind}`,
    resourceType: 'runtime_policy',
    resourceId: event.policyFile,
    result: event.kind === 'applied' ? 'success' : 'denied',
    metadata: {
      who: event.who,
      when: event.when,
      why: event.why,
      reasons: event.reasons,
      previousHash: event.previousHash,
      nextHash: event.nextHash,
    },
  }
}

export interface RuntimePolicyWatcherOptions {
  filePath: string
  /** 注入值仅在 [10, MAX_POLL_INTERVAL_MS] 内生效,超限截断。默认 1000ms。 */
  pollIntervalMs?: number
  auditSink?: (event: RuntimePolicyAuditEvent) => void
  now?: () => Date
  /** 拒绝事件无合法 changedBy 时使用的 who。 */
  fallbackWho?: string
}

export type RuntimePolicyListener = (policy: RuntimePolicy, event: RuntimePolicyAuditEvent) => void

export class RuntimePolicyWatcher {
  private readonly filePath: string
  readonly pollIntervalMs: number
  private readonly auditSink?: (event: RuntimePolicyAuditEvent) => void
  private readonly now: () => Date
  private readonly fallbackWho: string
  private current: RuntimePolicy
  private appliedHash: string | null = null
  private lastProcessedKey: string | null = null
  private lastEmittedEvent: RuntimePolicyAuditEvent | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly listeners = new Set<RuntimePolicyListener>()
  private inFlight: Promise<RuntimePolicyAuditEvent | null> | null = null

  constructor(options: RuntimePolicyWatcherOptions) {
    this.filePath = resolve(options.filePath)
    const requested = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
    this.pollIntervalMs = Math.min(
      MAX_POLL_INTERVAL_MS,
      Math.max(10, Math.floor(Number.isFinite(requested) ? requested : DEFAULT_POLL_INTERVAL_MS)),
    )
    this.auditSink = options.auditSink
    this.now = options.now ?? (() => new Date())
    this.fallbackWho = options.fallbackWho || 'system'
    this.current = structuredClone(DEFAULT_RUNTIME_POLICY) as RuntimePolicy
  }

  /** 当前生效策略;返回副本,避免消费方原地改写进程内唯一有效档。 */
  get policy(): RuntimePolicy {
    return structuredClone(this.current)
  }

  get lastEvent(): RuntimePolicyAuditEvent | null {
    return this.lastEmittedEvent
  }

  get isWatching(): boolean {
    return this.timer !== null
  }

  /** 首次同步一次文件,然后启动轮询;重复调用不叠加定时器。 */
  async start(): Promise<RuntimePolicyAuditEvent | null> {
    const first = await this.refresh()
    if (!this.timer) {
      this.timer = setInterval(() => {
        void this.refresh()
      }, this.pollIntervalMs)
      this.timer.unref?.()
    }
    return first
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  subscribe(listener: RuntimePolicyListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 手动/轮询共用入口;并发调用合并为同一次刷新。 */
  refresh(): Promise<RuntimePolicyAuditEvent | null> {
    if (this.inFlight) return this.inFlight
    const task = this.refreshOnce()
    this.inFlight = task
    void task.then(
      () => {
        if (this.inFlight === task) this.inFlight = null
      },
      () => {
        if (this.inFlight === task) this.inFlight = null
      },
    )
    return task
  }

  private async refreshOnce(): Promise<RuntimePolicyAuditEvent | null> {
    let content: string
    let mtime: string | undefined
    try {
      content = await readFile(this.filePath, 'utf8')
      try {
        mtime = (await stat(this.filePath)).mtime.toISOString()
      } catch {
        // mtime 只是 when 的候选来源,拿不到就用当前时间。
      }
    } catch (error) {
      return this.reject(
        'FILE_UNAVAILABLE',
        [`读取策略文件失败: ${error instanceof Error ? error.message : String(error)}`],
        null,
        mtime,
      )
    }

    const hash = contentHash(content)
    if (hash === this.lastProcessedKey) return null

    const parsed = parseRuntimePolicy(content)
    if (!parsed.ok) {
      return this.reject(parsed.code, parsed.reasons, hash, mtime)
    }

    const when = parsed.policy.audit.changedAt ?? mtime ?? this.now().toISOString()
    const event: RuntimePolicyAuditEvent = {
      kind: 'applied',
      who: parsed.policy.audit.changedBy,
      when,
      why: parsed.policy.audit.reason,
      reasons: [],
      previousHash: this.appliedHash,
      nextHash: parsed.hash,
      policyFile: basename(this.filePath),
    }
    // 先整份换入,再打点与通知:审计失败不会把策略回滚成旧值。
    this.current = parsed.policy
    this.appliedHash = parsed.hash
    this.lastProcessedKey = parsed.hash
    this.emit(event)
    return event
  }

  private reject(
    code: RuntimePolicyRejectCode,
    reasons: string[],
    hash: string | null,
    mtime: string | undefined,
  ): RuntimePolicyAuditEvent | null {
    const key = `rejected:${hash ?? code}:${reasons.join('|')}`
    if (key === this.lastProcessedKey) return null
    const event: RuntimePolicyAuditEvent = {
      kind: 'rejected',
      who: this.fallbackWho,
      when: mtime ?? this.now().toISOString(),
      why: `变更被拒绝(${code}):整份策略未生效,维持上一份有效策略`,
      reasons,
      previousHash: this.appliedHash,
      nextHash: null,
      policyFile: basename(this.filePath),
    }
    this.lastProcessedKey = key
    this.emit(event)
    return event
  }

  private emit(event: RuntimePolicyAuditEvent): void {
    this.lastEmittedEvent = event
    if (event.kind === 'applied') {
      for (const listener of this.listeners) {
        try {
          listener(this.policy, event)
        } catch {
          // 单个消费方异常不影响其他订阅者与已生效策略。
        }
      }
    }
    if (this.auditSink) {
      try {
        this.auditSink(event)
      } catch {
        // 审计落库失败不应让进程退回旧策略;宿主可另行补写。
      }
    }
  }
}

/** 一次性读取(不启动轮询),供启动脚本/单测在不建 watcher 时做静态校验。 */
export async function loadRuntimePolicy(filePath: string): Promise<RuntimePolicyParseResult> {
  try {
    return parseRuntimePolicy(await readFile(resolve(filePath), 'utf8'))
  } catch (error) {
    return {
      ok: false,
      code: 'FILE_UNAVAILABLE',
      reasons: [`读取策略文件失败: ${error instanceof Error ? error.message : String(error)}`],
    }
  }
}
