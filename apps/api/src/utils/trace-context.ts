// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * traceparent 上下文工具(2026-07-22 立,跨服务 traceparent 透传)。
 *
 * W3C Trace Context 格式:version-trace_id-parent_id-flags
 * 例:00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
 *
 * 核心能力:
 * - generateTraceparent():生成新 traceparent(新 trace)
 * - getTraceparentFromRequest():从 Fastify request 头解析
 * - propagateToHeaders():把 traceparent 注入到出站请求 headers(api → ai-service)
 * - extractTraceId():解析 trace_id(32 hex)
 */

import { randomBytes } from 'node:crypto'
import type { FastifyRequest } from 'fastify'

export interface TraceContext {
  traceId: string // 32 hex
  parentId: string // 16 hex
  version: string // 2 hex(通常 "00")
  flags: string // 2 hex(通常 "01" sampled)
}

/**
 * 生成 W3C traceparent 字符串。
 * 格式:version-trace_id-parent_id-flags
 */
export function generateTraceparent(): string {
  const version = '00'
  const traceId = randomBytes(16).toString('hex') // 32 hex
  const parentId = randomBytes(8).toString('hex') // 16 hex
  const flags = '01' // sampled
  return `${version}-${traceId}-${parentId}-${flags}`
}

/**
 * 从 Fastify request 的 traceparent 头解析 trace 上下文。
 * 如果头不存在或格式非法,返回 null。
 */
export function getTraceparentFromRequest(request: FastifyRequest): TraceContext | null {
  const header = request.headers['traceparent'] as string | undefined
  if (!header) return null
  return parseTraceparent(header)
}

/**
 * 解析 traceparent 字符串。
 * 格式:version-trace_id-parent_id-flags
 */
export function parseTraceparent(traceparent: string): TraceContext | null {
  const parts = traceparent.split('-')
  if (parts.length !== 4) return null
  const [version, traceId, parentId, flags] = parts
  if (!version || !traceId || !parentId || !flags) return null
  if (traceId.length !== 32 || parentId.length !== 16) return null
  if (!/^[0-9a-f]+$/i.test(traceId) || !/^[0-9a-f]+$/i.test(parentId)) return null
  return { version, traceId, parentId, flags }
}

/**
 * 提取 trace_id(32 hex)。
 */
export function extractTraceId(traceparent: string | undefined | null): string | null {
  if (!traceparent) return null
  const ctx = parseTraceparent(traceparent)
  return ctx?.traceId ?? null
}

/**
 * D172(2026-09-29 立):取"这一轮请求"的 trace id,供落库/审计写入口使用。
 *
 * 为什么单列一个出口:写入口需要的是**可空且已验形**的 id,而各调用点自己
 * `headers['traceparent']` + 自己 split 会造出第二份解析规则(两处算同一件事必漂移,
 * 本仓记过多次)。本函数只做"取头 → 走 parseTraceparent → 拿 traceId",**不新加解析器**。
 *
 * 三类"没有编号"的形态一律返回 null,不猜、不补一个看起来像的:
 *  - 没有 traceparent 头(非 HTTP 入口 / 未进入 onRequest 钩子)
 *  - 头是数组(同名重复头,"哪一条是本轮的"没有定义)
 *  - 头在但格式非法(长度/十六进制不合 W3C)
 * 返回 null 时列落 NULL ⇒ "这条记录没有关联键"是可见事实,而不是伪装成有。
 *
 * 最后一律 `toLowerCase()`:W3C 规定 trace-id 是小写十六进制,而 PG 的等值比较区分大小写
 * —— 同一个编号被写成两种大小写,就会变成**两条查不到对方的记录**(排查时正是按等值命中)。
 * 归一只发生在本出口,不是在解析器里放宽判据(非法仍返回 null)。
 */
export function traceIdFromRequest(
  request: FastifyRequest | undefined | null,
): string | null {
  if (!request) return null
  const raw = request.headers['traceparent']
  if (typeof raw !== 'string') return null
  const traceId = extractTraceId(raw)
  if (!traceId) return null
  // 全 0 的 trace id 按 W3C 是**非法值**(表示"没有 trace"),但本地 parseTraceparent 只看
  // "32 位十六进制" ⇒ 会放过它(这一格与 @ihui/types/src/traceparent.ts 那份更严的实现有分歧,
  // 已作为残余登记,不在本票顺手改旧解析器:放宽容易、改严会波及既有透传链路)。
  // 本出口只判"能不能当关联键":存进去等于给一批无关调用发同一个编号,反查必然串台。
  if (/^0+$/.test(traceId)) return null
  return traceId.toLowerCase()
}

/**
 * 把 traceparent 注入到出站请求 headers。
 * 用于 api 调用 ai-service 时透传 trace 上下文。
 *
 * 用法:
 *   const headers = propagateToHeaders(request)
 *   const resp = await fetch('http://ai-service:8803/api/llm/complete', { headers })
 *
 * 如果入站 request 无 traceparent,生成新的(开启新 trace)。
 * 如果有,透传原 traceparent(延续同一 trace)。
 */
export function propagateToHeaders(request?: FastifyRequest | null): Record<string, string> {
  const ctx = request ? getTraceparentFromRequest(request) : null
  const traceparent = ctx
    ? `${ctx.version}-${ctx.traceId}-${ctx.parentId}-${ctx.flags}`
    : generateTraceparent()
  return {
    traceparent: traceparent,
    'X-Trace-Id': ctx?.traceId ?? traceparent.split('-')[1] ?? '',
  }
}

/**
 * 生成子 span 的 traceparent(用于内部调用链)。
 * 保持同一 trace_id,生成新的 parent_id。
 */
export function childTraceparent(parent: TraceContext): string {
  const version = parent.version
  const traceId = parent.traceId
  const newParentId = randomBytes(8).toString('hex')
  const flags = parent.flags
  return `${version}-${traceId}-${newParentId}-${flags}`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
