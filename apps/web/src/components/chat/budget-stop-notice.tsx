// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { AlertTriangle } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { formatTokenCount } from '@/lib/model-context-capacity'
import { BUDGET_STOP_FALLBACK_TEXT, budgetStopReasonText } from '@ihui/shared/chat/budget-stop-note'
import {
  getBudgetConversationId,
  getBudgetEvent,
  getBudgetEventServerSnapshot,
  subscribeBudgetEvent,
} from '@/hooks/use-chat/budget-state'

/** 网关 `GET /ai/chat/conversations/:id/budget-stops` 的单条投影（字段见批次 3 契约）。 */
interface BudgetStopApiItem {
  id: string
  conversationId: string
  messageId: string | null
  level: string
  reasonCode: string
  scope?: string | null
  pillar?: string | null
  usedTokens?: number | null
  limitTokens?: number | null
  usagePercent?: number | null
  remainingTokens?: number | null
  stoppedAtIteration?: number | null
  createdAt: string
}

interface BudgetStopApiResponse {
  items: BudgetStopApiItem[]
}

/** 展示所需的停止事实：live 帧与查询回放共用同一份形状。 */
interface BudgetStopFacts {
  reasonCode: string | null | undefined
  usedTokens?: number | null
  limitTokens?: number | null
  usagePercent?: number | null
  percent?: number | null
  remainingTokens?: number | null
}

/** 内联提示条本体：只展示服务端算好的百分比字段，不再二次计算。 */
function BudgetStopNotice({ facts }: { facts: BudgetStopFacts }) {
  const reasonText = budgetStopReasonText(facts.reasonCode)
  const isKnownReason = reasonText !== BUDGET_STOP_FALLBACK_TEXT
  const hasUsage = typeof facts.usedTokens === 'number' || typeof facts.limitTokens === 'number'
  // 服务端已给出 usagePercent/percent 时原样展示；两者都缺席就不编造百分比。
  const percent =
    typeof facts.usagePercent === 'number' && Number.isFinite(facts.usagePercent)
      ? facts.usagePercent
      : typeof facts.percent === 'number' && Number.isFinite(facts.percent)
        ? facts.percent
        : null

  return (
    <div
      className="mx-2 my-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] leading-relaxed text-amber-900 dark:text-amber-200"
      data-testid="budget-stop-notice"
      data-reason-known={isKnownReason ? 'true' : 'false'}
    >
      <div className="flex items-start gap-1.5">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{reasonText}</p>
          <p
            className="mt-0.5 text-[11px] text-amber-800/90 dark:text-amber-300/90"
            data-testid="budget-stop-stats"
          >
            {hasUsage ? (
              <>
                已用{' '}
                {typeof facts.usedTokens === 'number' ? formatTokenCount(facts.usedTokens) : '—'}
                {' / '}
                限额{' '}
                {typeof facts.limitTokens === 'number' ? formatTokenCount(facts.limitTokens) : '—'}
              </>
            ) : (
              '用量与限额未提供'
            )}
            {percent !== null ? `（${percent}%）` : ''}
            {typeof facts.remainingTokens === 'number'
              ? ` · 剩余 ${formatTokenCount(facts.remainingTokens)}`
              : ''}
          </p>
          <p className="mt-0.5 text-[11px] text-amber-800/80 dark:text-amber-300/80">
            可调整预算或稍后重试。
          </p>
        </div>
      </div>
    </div>
  )
}

/** 从查询回放里挑最新一条 stopped（接口未承诺排序，按 createdAt 取最大）。 */
function latestStopped(items: BudgetStopApiItem[]): BudgetStopApiItem | null {
  let latest: BudgetStopApiItem | null = null
  let latestAt = Number.NEGATIVE_INFINITY
  for (const item of items) {
    if (item.level !== 'stopped') continue
    const at = Date.parse(item.createdAt)
    const stamp = Number.isFinite(at) ? at : Number.NEGATIVE_INFINITY
    if (latest === null || stamp > latestAt) {
      latest = item
      latestAt = stamp
    }
  }
  return latest
}

/**
 * 会话消息列表区的停止提示宿主：
 * - 进入会话时查 `/budget-stops`（刷新后仍可见）；
 * - 流内 `onBudget(level='stopped')` 到达时立即优先展示 live 帧；
 * - 查询失败静默 —— 不打断聊天，也不弹 toast（停止帧自身已提示一次）。
 */
export function SessionBudgetStopNotice({ conversationId }: { conversationId: string | null }) {
  const liveEvent = React.useSyncExternalStore(
    subscribeBudgetEvent,
    getBudgetEvent,
    getBudgetEventServerSnapshot,
  )
  const liveOwner = getBudgetConversationId()
  const [replayed, setReplayed] = React.useState<{
    conversationId: string
    item: BudgetStopApiItem
  } | null>(null)

  React.useEffect(() => {
    if (!conversationId) {
      setReplayed(null)
      return
    }
    const controller = new AbortController()
    let disposed = false
    void (async () => {
      try {
        const result = await fetchApi<BudgetStopApiResponse>(
          `/ai/chat/conversations/${encodeURIComponent(conversationId)}/budget-stops?limit=20`,
          { signal: controller.signal },
        )
        if (disposed || controller.signal.aborted) return
        if (!result.success || !result.data?.items) {
          setReplayed(null)
          return
        }
        const item = latestStopped(result.data.items)
        setReplayed(item ? { conversationId, item } : null)
      } catch {
        // 静默：账本/停止回放不可得不影响聊天主链路
        if (!disposed && !controller.signal.aborted) setReplayed(null)
      }
    })()
    return () => {
      disposed = true
      controller.abort()
    }
  }, [conversationId])

  if (!conversationId) return null

  const liveFacts: BudgetStopFacts | null =
    liveEvent?.level === 'stopped' && liveOwner === conversationId
      ? {
          reasonCode: liveEvent.reasonCode,
          usedTokens: liveEvent.usedTokens,
          limitTokens: liveEvent.limitTokens,
          usagePercent: liveEvent.usagePercent,
          percent: liveEvent.percent,
          remainingTokens: liveEvent.remainingTokens,
        }
      : null

  if (liveFacts) return <BudgetStopNotice facts={liveFacts} />

  if (replayed && replayed.conversationId === conversationId) {
    return (
      <BudgetStopNotice
        facts={{
          reasonCode: replayed.item.reasonCode,
          usedTokens: replayed.item.usedTokens,
          limitTokens: replayed.item.limitTokens,
          usagePercent: replayed.item.usagePercent,
          remainingTokens: replayed.item.remainingTokens,
        }}
      />
    )
  }

  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
