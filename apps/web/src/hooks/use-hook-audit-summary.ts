// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 2026-11-21 第 41 项:钩子审计台账摘要(web 侧消费)。
 *
 * 后端唯一判据 = ai-service `GET /api/agent/hook-audit/summary`
 * (`core.hook_audit.summarize_hook_audit`),本模块只做**形状收窄**:把 snake/宽松
 * 的 JSON 收成与前端 `HookRunStats` 同一字段集,不重算一条计数。
 *
 * 为什么需要它:第 38 项的会话累计只活在内存里,刷新页面/重进会话即归零;
 * 台账摘要让"这一轮到底跑没跑过、失败几次"在重连后仍可回答。
 * `available=false` 表示台账不存在(区分"取不到"与"零次运行"),此时返回 null。
 */

import React from 'react'
import { fetchAiServiceJson } from '@/lib/api'
import type { HookRunStats } from '@/hooks/hook-run-stats'

/** 只做收窄:数字字段逐个校验,负数按 0 处理(远端坏数据不许把面板画成负数)。 */
export function normalizeHookAuditSummary(raw: unknown): HookRunStats | null {
  if (!raw || typeof raw !== 'object') return null
  const body = raw as Record<string, unknown>
  if (body.available !== true) return null
  const num = (key: string): number => {
    const v = body[key]
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0
  }
  const total = Math.floor(num('total'))
  if (total === 0) return null
  const stats: HookRunStats = {
    total,
    ok: Math.floor(num('ok')),
    timeout: Math.floor(num('timeout')),
    error: Math.floor(num('error')),
    totalDurationMs: Math.floor(num('totalDurationMs')),
    slowestMs: Math.floor(num('slowestMs')),
  }
  // 三态之和若超过 total,说明远端计数自相矛盾 ⇒ 不呈现(宁可空着也不报错数)。
  if (stats.ok + stats.timeout + stats.error > total) return null
  return stats
}

/**
 * @param sessionId 要查的会话;`null` = 整个台账(调用方必须自己在文案里写明"全量")
 * @param enabled 仅在面板可见且需要回落时取(默认不产生请求)
 */
export function useHookAuditSummary(
  sessionId: string | null,
  enabled: boolean,
): HookRunStats | null {
  const [stats, setStats] = React.useState<HookRunStats | null>(null)

  React.useEffect(() => {
    if (!enabled) {
      setStats(null)
      return
    }
    let cancelled = false
    const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''
    void (async () => {
      try {
        const res = await fetchAiServiceJson<{ data?: unknown }>(
          `/api/agent/hook-audit/summary${query}`,
        )
        if (cancelled) return
        setStats(res.success ? normalizeHookAuditSummary(res.data?.data) : null)
      } catch {
        if (!cancelled) setStats(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId, enabled])

  return stats
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
