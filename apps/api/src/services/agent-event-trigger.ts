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
import { db } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { agentEventTriggers, type AgentEventTrigger, type EventTriggerAction } from '@ihui/database'
import { captureAgentRuntimeStream } from './agent-runtime-stream.js'

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
export type GitHubEventName = 'pull_request' | 'issues' | 'push'

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
