// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 事件唤醒型云 Agent —— 触发服务(2026-09-08 立)。
 *
 * 职责:
 * 1. GitHub webhook 签名校验(HMAC-SHA256,对标 X-Hub-Signature-256 真校验)。
 * 2. 按 (repoFullName, event) 匹配 agent_event_triggers 规则。
 * 3. 命中后调用现有 agent-runtime 执行器(captureAgentRuntimeStream,与 automations
 *    调度器同源)创建一次 agent 运行 —— 复用执行器,不重写。
 * 4. 执行失败不重试(见 fireEventTrigger 注释):webhook 语义是"尽力触发",重试由
 *    GitHub 自身的 webhook 投递重试承担,服务端重复投递由 X-GitHub-Delivery 去重拦截。
 *
 * 本文件刻意把"纯函数"(签名校验 / 匹配 / 占位符渲染 / 去重)与"副作用"(调执行器)
 * 分离,纯函数可单测,无需 DB / 网络。
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { FastifyRequest } from 'fastify'
import { z } from 'zod'
import { db } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { agentEventTriggers, type AgentEventTrigger, type EventTriggerAction } from '@ihui/database'
import { captureAgentRuntimeStream } from './agent-runtime-stream.js'
// D30① 信源接入:摘要脱敏复用既有正则脱敏出口(services/log-sanitizer),禁止自拼第二套。
import { sanitizeText } from './log-sanitizer.js'

// =============================================================================
// 纯函数:GitHub webhook 签名校验
// =============================================================================

/**
 * 解析 X-Hub-Signature-256 头,提取十六进制摘要。
 * GitHub 格式:`sha256=<hex>`;非此格式返回 null(视为无签名)。
 */
export function parseSignatureHeader(header: string | undefined): string | null {
  if (!header) return null
  const m = header.trim().match(/^sha256=([0-9a-fA-F]+)$/)
  return m?.[1] ?? null
}

/**
 * 验证 GitHub webhook 签名(HMAC-SHA256 真校验)。
 * - 无签名头 / 格式非法 → false
 * - 长度不一致直接 false(timingSafeEqual 要求同长)
 * - 用 timingSafeEqual 防时序攻击
 * - secret 为空串时恒返回 false(调用方据 GITHUB_WEBHOOK_SECRET 是否已配置决定 503)
 */
export function verifyGitHubSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!secret) return false
  const provided = parseSignatureHeader(signatureHeader)
  if (!provided) return false
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const expectedBuf = Buffer.from(expected, 'utf8')
  const providedBuf = Buffer.from(provided, 'utf8')
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}

// =============================================================================
// 纯函数:规则匹配 + 占位符渲染
// =============================================================================

/** GitHub 事件名(本服务支持的子集) */
export type GitHubEventName = 'pull_request' | 'issues' | 'push' | 'code_scanning_alert'

/**
 * 按 (repoFullName, event) 从候选规则中筛出启用中的命中项。
 * 调用方需先确保 event 属于支持子集且 action 合法,本函数只做 repo+event+enabled 匹配。
 */
export function matchTriggers(
  repoFullName: string,
  event: string,
  triggers: AgentEventTrigger[],
): AgentEventTrigger[] {
  return triggers.filter(
    (t) => t.enabled === 'true' && t.event === event && t.repoFullName === repoFullName,
  )
}

/**
 * 把 action.prompt 中的 {{key}} 占位符替换为上下文值。
 * 未匹配的占位符原样保留(不抛错),避免一次渲染失败阻断触发。
 */
export function buildTriggerPrompt(
  action: EventTriggerAction,
  ctx: Record<string, string>,
): string {
  let prompt = action.prompt
  for (const [key, value] of Object.entries(ctx)) {
    prompt = prompt.split(`{{${key}}}`).join(value)
  }
  return prompt
}

// =============================================================================
// 幂等去重:X-GitHub-Delivery 头(每次投递唯一 uuid)
// =============================================================================

/**
 * 内存 LRU 去重器(进程生命周期内有效)。
 *
 * 取舍说明:选用内存 LRU 而非 DB 字段,
 * 理由① webhook 重投发生在秒级~分钟级窗口内,进程内去重足够拦掉 99% 重复;
 * 理由② 避免为去重专门加一张投递记录表 / 唯一索引,迁移与维护成本更低;
 * 代价:进程重启后去重窗口清空,此时由"一次触发仅创建一次 agent 运行 + GitHub
 * 重投天然低频"共同兜底,业务可承受。
 * 容量上限保护内存,超出后淘汰最旧条目。
 */
export class DeliveryDedup {
  private store = new Map<string, number>()
  constructor(private readonly capacity: number = 10000) {}

  /**
   * 记录一次投递。返回 true 表示"首次见到该 deliveryId"(放行),
   * 返回 false 表示"此前已见过"(重复,应跳过)。
   */
  record(deliveryId: string): boolean {
    if (!deliveryId) return true // 无 delivery 头不拦(交由签名/规则逻辑处理)
    if (this.store.has(deliveryId)) return false
    if (this.store.size >= this.capacity) {
      const oldest = this.store.keys().next().value as string | undefined
      if (oldest) this.store.delete(oldest)
    }
    this.store.set(deliveryId, Date.now())
    return true
  }

  /** 测试用:清空 */
  clear(): void {
    this.store.clear()
  }
}

/** 单进程共享去重器(路由使用) */
export const deliveryDedup = new DeliveryDedup()

// =============================================================================
// 副作用:触发一次 agent 运行(复用现有执行器)
// =============================================================================

/**
 * 命中规则后,调用现有 agent-runtime 执行器创建一次 agent 运行。
 *
 * 注:执行失败不重试。原因:webhook 语义是"尽力触发一次",GitHub 自身重试投递时
 * 由 deliveryId 去重拦截重复;若此处对单条投递内失败做重试,会与 GitHub 的投递重试
 * 叠加导致重复触发 / 资源浪费。失败仅记日志 + 落 lastResult,由用户在前端查看。
 *
 * @param trigger 命中的触发规则
 * @param request 当前 Fastify request(trace 透传);后台触发传 null
 * @returns 执行摘要(供落库 / 返回)
 */
export async function fireEventTrigger(
  trigger: AgentEventTrigger,
  request: FastifyRequest | null,
): Promise<{ summary: string | null }> {
  const now = new Date()
  const capture = await captureAgentRuntimeStream(trigger.action.prompt, request, {
    mode: trigger.action.mode ?? 'auto',
    sessionId: `evt_${trigger.id}_${now.getTime()}`,
    botId: trigger.action.agentId ?? trigger.id,
  })
  const summary =
    capture.summary ??
    (capture.contentTail.trim() ? capture.contentTail.trim().slice(-500) : null) ??
    (capture.errorMessage ? `执行失败: ${capture.errorMessage}` : '执行完成')

  // 落 lastFiredAt + lastResult(失败也记,便于前端排查;不重试)
  await db
    .update(agentEventTriggers)
    .set({
      lastFiredAt: now,
      lastResult: { finishedAt: now.toISOString(), summary },
      updatedAt: now,
    })
    .where(eq(agentEventTriggers.id, trigger.id))
    .catch(() => {
      // 落库失败不阻断主流程(webhook 已返回 200),仅忽略
    })

  return { summary }
}

/**
 * 触发但不等待执行完成(webhook 立即 200 返回,执行异步进行)。
 * 内部已 catch,不会因执行异常导致 unhandledRejection。
 */
export function fireEventTriggerAsync(
  trigger: AgentEventTrigger,
  request: FastifyRequest | null,
  logger?: { warn: (obj: unknown, msg: string) => void },
): void {
  void fireEventTrigger(trigger, request).catch((err) => {
    logger?.warn({ triggerId: trigger.id, err: String(err) }, '[event-trigger] 触发执行失败')
  })
}

// =============================================================================
// D30① 无人值守修复闭环 —— 信源接入(ci_failed / gate_failed)
// =============================================================================

/**
 * 两种新触发 kind。语义与 agent_event_triggers.event(varchar(40))同域,
 * 由 CI 侧 workflow 经**既有 HMAC 鉴权路由** POST /api/webhooks/github 投递,
 * 不新造匿名端点(鉴权沿用 GITHUB_WEBHOOK_SECRET 签名校验,不放宽)。
 */
export const UNATTENDED_INTAKE_KINDS = ['ci_failed', 'gate_failed'] as const
export type UnattendedIntakeKind = (typeof UNATTENDED_INTAKE_KINDS)[number]

export function isUnattendedIntakeKind(name: string): name is UnattendedIntakeKind {
  return (UNATTENDED_INTAKE_KINDS as readonly string[]).includes(name)
}

/** 摘要入参上限(防整段日志塞进事件;也是脱敏正则的复杂度上限) */
export const INTAKE_SUMMARY_INPUT_MAX_CHARS = 2000
/** 摘要进入事件前的最终截断长度(短文本,单位字符) */
export const INTAKE_SUMMARY_MAX_CHARS = 300

/**
 * 去重窗口 = 4h。依据:与 §5e 运维告警去重窗口(默认 4h)同档 —— 一次 CI 连红的
 * 重跑/重投集中发生在分钟~小时级,4h 足以拦风暴,又保证持续失败隔天仍能再次入队;
 * 修复产生新 commit 后 sha 变化,天然产生新键,不受本窗口压制。
 */
export const INTAKE_DEDUP_WINDOW_MS = 4 * 60 * 60 * 1000

/** 来源三元组(workflow 名 / job / commit sha),两种 kind 共用 */
const intakeSourceFields = {
  /** CI workflow 显示名(如 "CI (Monorepo)") */
  workflow: z.string().min(1).max(200),
  /** 失败的 job 名 */
  job: z.string().min(1).max(200),
  /** 触发失败的 commit sha(短/全长十六进制) */
  commitSha: z.string().regex(/^[0-9a-fA-F]{7,40}$/, 'commitSha 须为 7-40 位十六进制'),
} as const

const intakeCommonFields = {
  /** 仓库全名 owner/repo,与 agent_event_triggers.repo_full_name 匹配 */
  repo: z
    .string()
    .min(3)
    .max(255)
    .regex(/^[^/\s]+\/[^/\s]+$/, 'repo 须为 owner/name 形态'),
  /** 可追溯链接(GitHub Actions run URL) */
  runUrl: z.url().max(500),
  /** 失败摘要(短文本;入口上限 INTAKE_SUMMARY_INPUT_MAX_CHARS) */
  summary: z.string().min(1).max(INTAKE_SUMMARY_INPUT_MAX_CHARS),
} as const

/** ci_failed:GitHub Actions 红。strict:未知字段一律拒绝 */
export const ciFailedPayloadSchema = z.strictObject({
  kind: z.literal('ci_failed'),
  ...intakeCommonFields,
  ...intakeSourceFields,
})

/** gate_failed:全量守门(guardian-runner)失败。多一个可选守门项名,同样 strict */
export const gateFailedPayloadSchema = z.strictObject({
  kind: z.literal('gate_failed'),
  ...intakeCommonFields,
  ...intakeSourceFields,
  /** 失败的守门项 id/名(可选,便于点名归因) */
  guardianId: z.string().min(1).max(80).optional(),
})

const intakePayloadSchema = z.discriminatedUnion('kind', [
  ciFailedPayloadSchema,
  gateFailedPayloadSchema,
])

export type UnattendedIntakePayload = z.infer<typeof intakePayloadSchema>

/** 归一化后的入队载荷:summary 已脱敏+截断,字段扁平可直接喂占位符渲染 */
export interface NormalizedIntake {
  kind: UnattendedIntakeKind
  repo: string
  workflow: string
  job: string
  commitSha: string
  runUrl: string
  summary: string
  guardianId?: string
}

/**
 * 摘要清洗:先过**既有正则脱敏出口** sanitizeText(sk- 前缀 API Key / Bearer JWT /
 * email / phone,见 services/log-sanitizer.ts,禁止自拼第二套),
 * 再折叠空白、按字符数截断。
 * 顺序刻意"先脱敏后截断":截断点若落在凭据中段会留下半截秘钥。
 */
export function buildIntakeSummary(raw: string): string {
  const oneLine = sanitizeText(raw).replace(/\s+/g, ' ').trim()
  if (oneLine.length <= INTAKE_SUMMARY_MAX_CHARS) return oneLine
  return `${oneLine.slice(0, INTAKE_SUMMARY_MAX_CHARS - 1)}…`
}

export type IntakeParseResult =
  { ok: true; data: NormalizedIntake; dedupKey: string } | { ok: false; errors: string[] }

/**
 * 单一入口:kind 一致性 + strict 校验 + 摘要清洗 + 去重键构造。
 * eventName 来自 x-github-event 头;与 payload.kind 不一致即拒(不允许头/体两套真相)。
 * 本函数是纯函数,不触 DB / 网络,可直接单测。
 */
export function parseUnattendedIntake(eventName: string, payload: unknown): IntakeParseResult {
  if (!isUnattendedIntakeKind(eventName)) {
    return { ok: false, errors: [`unsupported_event:${eventName}`] }
  }
  const parsed = intakePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    }
  }
  if (parsed.data.kind !== eventName) {
    return {
      ok: false,
      errors: [`kind_mismatch: header=${eventName} body=${parsed.data.kind}`],
    }
  }
  const data: NormalizedIntake = {
    kind: parsed.data.kind,
    repo: parsed.data.repo,
    workflow: parsed.data.workflow,
    job: parsed.data.job,
    commitSha: parsed.data.commitSha.toLowerCase(),
    runUrl: parsed.data.runUrl,
    summary: buildIntakeSummary(parsed.data.summary),
    ...(parsed.data.kind === 'gate_failed' && parsed.data.guardianId
      ? { guardianId: parsed.data.guardianId }
      : {}),
  }
  return {
    ok: true,
    data,
    dedupKey: intakeDedupKey(data.kind, data.repo, data.commitSha, data.job),
  }
}

/** 去重键:(kind, repo, sha, job)。sha 归一小写,避免长短/大小写两套键 */
export function intakeDedupKey(
  kind: UnattendedIntakeKind,
  repo: string,
  commitSha: string,
  job: string,
): string {
  return `${kind}|${repo}|${commitSha.toLowerCase()}|${job}`
}

/**
 * 去重判据(纯函数,便于单测):窗口内无该键记录才放行。
 * lastSeenAt 由调用方持有(本模块的 IntakeStormGuard 或 Map 均可),
 * 判据本身零副作用。
 */
export function shouldAcceptIntake(
  lastSeenAt: ReadonlyMap<string, number>,
  key: string,
  nowMs: number,
  windowMs: number = INTAKE_DEDUP_WINDOW_MS,
): boolean {
  const last = lastSeenAt.get(key)
  if (last === undefined) return true
  return nowMs - last >= windowMs
}

/** 风暴保护容器:纯判据 + 进程内记录(取舍同 DeliveryDedup:容量上限 + 最旧淘汰) */
export class IntakeStormGuard {
  private readonly store = new Map<string, number>()
  constructor(
    private readonly windowMs: number = INTAKE_DEDUP_WINDOW_MS,
    private readonly capacity: number = 5000,
  ) {}

  /** 返回 true = 放行入队;false = 窗口内重复,应跳过 */
  accept(key: string, nowMs: number = Date.now()): boolean {
    if (!shouldAcceptIntake(this.store, key, nowMs, this.windowMs)) return false
    if (this.store.size >= this.capacity) {
      const oldest = this.store.keys().next().value as string | undefined
      if (oldest !== undefined) this.store.delete(oldest)
    }
    this.store.set(key, nowMs)
    return true
  }

  /** 测试用:清空 */
  clear(): void {
    this.store.clear()
  }
}

/** 单进程共享风暴保护器(路由接线时使用) */
export const intakeStormGuard = new IntakeStormGuard()

/** 归一化载荷 → buildTriggerPrompt 的占位符上下文 */
export function buildIntakePromptCtx(data: NormalizedIntake): Record<string, string> {
  return {
    kind: data.kind,
    repo: data.repo,
    workflow: data.workflow,
    job: data.job,
    commitSha: data.commitSha,
    runUrl: data.runUrl,
    summary: data.summary,
    ...(data.guardianId ? { guardianId: data.guardianId } : {}),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
