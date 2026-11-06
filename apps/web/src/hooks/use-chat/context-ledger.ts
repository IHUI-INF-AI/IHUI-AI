// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌‌​‌‍‍‌​​‌​​‌‍‍‌‌​‌‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​​‌​​‌‌‌‌‍‍​‌​​‌​​​‍‍‌‌‌‌‌‌​‍‍‌​‌​​​‌‍‍‌​‌‌‌‌‌‌‌​‌‌‌‍‍​‌‌‌‌‌‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌‌‌‌​‌‌‍‌‍‌​‍‍​‌​​​​‌‍‍​‌‌‌‌‌‌​‌​‌‍‍‌​​‌‌​‌‍⁠

/**
 * 七类上下文账本的查询层（批次 3，2026-11-06 立）。
 *
 * 服务端账本是**回放旁路**：进入会话 / 每轮 usage 落账后查最近 20 条；失败静默，
 * 不弹 toast、不阻断聊天。百分比一律取服务端 `percentage` 字段，端内不二次计算
 * （口径与 clamp 单一出口由服务端保证）。
 */

import * as React from 'react'

import { fetchApi } from '@/lib/api'
import type { ContextLedger } from '@ihui/shared'

/** 查询回放的单条账本（在账本本体上补落库标识与轮次）。 */
export interface ContextLedgerRecord extends ContextLedger {
  id: string
  conversationId: string
  messageId: string | null
  /** 第几轮 assistant turn（1 起，由网关按会话内轮次编号） */
  turnIndex: number
  createdAt: string
}

interface ContextLedgerApiResponse {
  items: ContextLedgerRecord[]
}

export interface ContextLedgerState {
  latest: ContextLedgerRecord | null
  items: ContextLedgerRecord[]
  loading: boolean
  error: string | null
  refresh: () => void
}

/** 新→旧：接口未承诺排序，端内按轮次/时间统一排一次，列表与 latest 同源。 */
function sortNewestFirst(items: ContextLedgerRecord[]): ContextLedgerRecord[] {
  return [...items].sort((a, b) => {
    if (b.turnIndex !== a.turnIndex) return b.turnIndex - a.turnIndex
    const at = Date.parse(a.createdAt)
    const bt = Date.parse(b.createdAt)
    const aStamp = Number.isFinite(at) ? at : 0
    const bStamp = Number.isFinite(bt) ? bt : 0
    return bStamp - aStamp
  })
}

export function useContextLedger(
  conversationId: string | null,
  /** 刷新信号（通常传 usageByMessageId 对象引用：每轮 usage 落定即换引用） */
  refreshKey?: unknown,
): ContextLedgerState {
  const [items, setItems] = React.useState<ContextLedgerRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [nonce, setNonce] = React.useState(0)
  const refresh = React.useCallback(() => setNonce((value) => value + 1), [])

  React.useEffect(() => {
    if (!conversationId) {
      setItems([])
      setError(null)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    let disposed = false
    setLoading(true)
    void (async () => {
      try {
        const result = await fetchApi<ContextLedgerApiResponse>(
          `/ai/chat/conversations/${encodeURIComponent(conversationId)}/context-ledger?limit=20`,
          { signal: controller.signal },
        )
        if (disposed || controller.signal.aborted) return
        if (!result.success || !result.data?.items) {
          // 静默：账本不可得时回退客户端归因，不打断聊天
          setItems([])
          setError(result.error ?? '账本查询失败')
          return
        }
        setItems(sortNewestFirst(result.data.items))
        setError(null)
      } catch (err) {
        if (disposed || controller.signal.aborted) return
        setItems([])
        setError(err instanceof Error ? err.message : '账本查询失败')
      } finally {
        if (!disposed && !controller.signal.aborted) setLoading(false)
      }
    })()
    return () => {
      disposed = true
      controller.abort()
    }
  }, [conversationId, refreshKey, nonce])

  const latest = items[0] ?? null
  return { latest, items, loading, error, refresh }
}
