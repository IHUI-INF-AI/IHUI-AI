// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * D86(G-117)钩子摘要的纯推导层 —— 卡片只渲染,判定全在这里。
 *
 * 本文件在 HEAD 里**一直缺失**(守门 98 于 2026-09-25 实测:两处悬空具名导入,
 * `hook-summary-card.tsx` 与它的测试都 import 了从未入库的 `./hook-summary`)⇒ 按这份
 * 已入库的契约(调用方 + 测试断言)补回,不另起设计。
 */

/** 来源枚举:与 ai-service 侧 hook 归属对齐;不在表内的值一律丢弃(不伪造归属)。 */
export const HOOK_SUMMARY_SOURCES = ['admin', 'user', 'project', 'plugin', 'session'] as const

export type HookSummarySource = (typeof HOOK_SUMMARY_SOURCES)[number]

export type HookSummaryState = 'running' | 'blocked' | 'failed' | 'ok' | 'idle'

export interface HookSummaryInput {
  runs: number
  failed?: number
  blocked?: number
  running?: boolean
  /** null / undefined = 数据面未提供归属(与"提供了但全是非法值"同判未提供) */
  sources?: readonly string[] | null
}

export interface HookSummaryView {
  state: HookSummaryState
  runs: number
  failed: number
  blocked: number
  sources: HookSummarySource[]
  hasSourceData: boolean
}

/** 客户端计数不可信:负数/NaN/Infinity 归 0,小数向下取整。 */
function sanitizeCount(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0
  return value > 0 ? Math.floor(value) : 0
}

function sanitizeSources(sources: readonly string[] | null | undefined): HookSummarySource[] {
  if (!sources) return []
  return HOOK_SUMMARY_SOURCES.filter((s) => sources.includes(s))
}

export function deriveHookSummary(input: HookSummaryInput): HookSummaryView {
  const runs = sanitizeCount(input.runs)
  const failed = sanitizeCount(input.failed)
  const blocked = sanitizeCount(input.blocked)
  const sources = sanitizeSources(input.sources)
  const state: HookSummaryState = input.running
    ? 'running'
    : blocked > 0
      ? 'blocked'
      : failed > 0
        ? 'failed'
        : runs > 0
          ? 'ok'
          : 'idle'
  return { state, runs, failed, blocked, sources, hasSourceData: sources.length > 0 }
}

/** 失败口径:只有 error 事件,与 commit.after 上以 `failed:` 开头的摘要算失败。 */
export function countFailedHookEvents(
  events: readonly { event: string; summary?: string }[],
): number {
  return events.filter(
    (e) =>
      e.event === 'error' ||
      (e.event === 'commit.after' && (e.summary ?? '').startsWith('failed:')),
  ).length
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
