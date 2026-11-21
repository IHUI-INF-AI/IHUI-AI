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

/**
 * 2026-11-21 第 44 项:台账摘要比会话累计多两格「读数可信度」。
 *
 * 起因:后端 `summarize_hook_audit` 只读台账尾部 `max_lines` 行(默认 20000),
 * 超过就置 `truncated: true`;第 42 项刚把这个判定从「读到行数 ≥ 上限」改成
 * 「总行数 > 上限」,恰好等于上限不再误报。但前端第 41 项只收了六个计数,
 * 把 `truncated` / `linesRead` 直接丢掉 ⇒ 「尾部截取」与「全量」在面板上长得一模一样,
 * 用户会把两万行之后的历史当成"没跑过"。
 *
 * 这里把这两格显式收进类型,显示层由 `HookReadout` 负责标注;`linesRead` 不许
 * 冒充 `total`(截断时前者只是读到的份数)。
 */
export type HookAuditStats = HookRunStats & {
  /** 台账总行数超过读取上限 ⇒ 计数只覆盖尾部 */
  truncated: boolean
  /** 本次实际读到的台账行数(未截断时等于台账行数) */
  linesRead: number
  /**
   * 2026-11-21 第 45 项:轮转备份 `<台账>.1` 的字节数;`null` = 没有备份。
   * 刚轮转完时当前台账是空的(total=0),没有这一格就会和"从没跑过"长得一样。
   */
  backupBytes: number | null
  /**
   * 2026-11-21 第 49 项:当前台账字节数与轮转上限(均实测;`null` = 取不到,不折 0)。
   * 只保留"当前 + 一份备份",到上限即覆盖备份 ⇒ 容量是"历史还能留多久"的读数。
   */
  sizeBytes: number | null
  maxBytes: number | null
}

/** 只做收窄:数字字段逐个校验,负数按 0 处理(远端坏数据不许把面板画成负数)。 */
export function normalizeHookAuditSummary(raw: unknown): HookAuditStats | null {
  if (!raw || typeof raw !== 'object') return null
  const body = raw as Record<string, unknown>
  const num = (key: string): number => {
    const v = body[key]
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0
  }
  const total = body.available === true ? Math.floor(num('total')) : 0
  const backupRaw = body.backupBytes
  const backupBytes =
    typeof backupRaw === 'number' && Number.isFinite(backupRaw) && backupRaw > 0
      ? Math.floor(backupRaw)
      : null
  // 第 49 项:容量两格同样只认正有限数;`0` 字节等于"还没写",按 null 呈现(不报"0%"协同假读数)。
  const posOrNull = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : null
  const sizeBytes = posOrNull(body.sizeBytes)
  const maxBytes = posOrNull(body.maxBytes)
  // 第 45 项:当前台账为空但备份还在时,后端 `available` 就是 false ——
  // 这一态必须报(否则轮转被读成零次);"取不到且无备份"才归 null。
  if (body.available !== true && backupBytes === null) return null
  if (total === 0 && backupBytes === null) return null
  const stats: HookAuditStats = {
    total,
    ok: Math.floor(num('ok')),
    timeout: Math.floor(num('timeout')),
    error: Math.floor(num('error')),
    totalDurationMs: Math.floor(num('totalDurationMs')),
    slowestMs: Math.floor(num('slowestMs')),
    // 只有显式 `true` 才算截断:字段缺失/坏值一律按"未截断"呈现(失效方向 = 少标一次,不多标)。
    truncated: body.truncated === true,
    linesRead: Math.floor(num('linesRead')),
    backupBytes,
    sizeBytes,
    maxBytes,
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
): HookAuditStats | null {
  const [stats, setStats] = React.useState<HookAuditStats | null>(null)

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
