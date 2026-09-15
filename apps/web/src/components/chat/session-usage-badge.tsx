// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Coins, Loader2 } from 'lucide-react'

import { getAgentTokenUsage, type AgentTokenUsageSummary } from '@ihui/api-client'
import { Tooltip } from '@/components/feedback'
import { formatNumber } from '@/lib/date-utils'

/**
 * 混合模型粗估单价(¥ / 1K token)。
 * 真实分模型计价需要价表(GAP-PLAN「成本真网计价」项),此处仅为 UI 粗估:
 * 取主流模型混合均价量级,徽章与 hover 明细均标注"估算"口径。
 */
const ESTIMATED_CNY_PER_1K_TOKENS = 0.02

/** 按 token 总量估算费用(¥,混合单价粗估) */
function estimateCostCny(totalTokens: number): number {
  return (totalTokens / 1000) * ESTIMATED_CNY_PER_1K_TOKENS
}

export interface SessionUsageBadgeProps {
  /** 当前会话 ID(为空 = 新对话,不渲染) */
  conversationId: string | null
  /** 是否流式中:流式 SSE 无 usage 事件,结束(true→false)后拉端点刷新 */
  isStreaming: boolean
  /** 当前会话模型(预留展示位,统计口径以 usage 接口返回为准) */
  model?: string
}

/**
 * 会话累计 Token / 费用紧凑徽章(2026-09-07 工作线 A)。
 * 挂载于 AI 面板 header(标题右侧):显示当前会话累计 token 与估算费用(¥),
 * hover 展开明细(输入 / 输出 / 请求数 / 估算口径)。数据源 checkpoint 逐轮估算,
 * 会话切换拉取一次;流式结束后再刷新兜底。
 */
export function SessionUsageBadge({ conversationId, isStreaming }: SessionUsageBadgeProps) {
  const t = useTranslations('chat.sessionUsage')
  const [usage, setUsage] = React.useState<AgentTokenUsageSummary | null>(null)
  const [loading, setLoading] = React.useState(false)

  const refresh = React.useCallback(async (id: string) => {
    setLoading(true)
    try {
      const summary = await getAgentTokenUsage(id)
      setUsage(summary.totalTokens > 0 ? summary : null)
    } catch {
      setUsage(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // 会话切换 → 拉取一次
  React.useEffect(() => {
    if (!conversationId) {
      setUsage(null)
      return
    }
    void refresh(conversationId)
  }, [conversationId, refresh])

  // 流式结束(true→false)→ 再拉端点刷新(SSE 流内无 usage 事件的兜底)
  const prevStreamingRef = React.useRef(isStreaming)
  React.useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && conversationId) {
      void refresh(conversationId)
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming, conversationId, refresh])

  if (!conversationId || !usage) return null

  const cost = estimateCostCny(usage.totalTokens)
  return (
    <Tooltip
      content={
        <div className="flex flex-col gap-0.5">
          <span className="tabular-nums">
            {t('promptTokens')}: {formatNumber(usage.promptTokens)}
          </span>
          <span className="tabular-nums">
            {t('completionTokens')}: {formatNumber(usage.completionTokens)}
          </span>
          <span className="tabular-nums">
            {t('requests')}: {usage.requests}
          </span>
          <span className="text-muted-foreground">{t('estimateHint')}</span>
        </div>
      }
    >
      <span
        data-testid="session-usage-badge"
        aria-label={t('ariaLabel')}
        className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-muted px-2 text-[10px] font-medium leading-none tabular-nums text-muted-foreground"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <Coins className="h-3 w-3 shrink-0" aria-hidden="true" />
        )}
        <span className="whitespace-nowrap">{formatNumber(usage.totalTokens)}</span>
        <span className="whitespace-nowrap text-foreground">¥{cost.toFixed(3)}</span>
      </span>
    </Tooltip>
  )
}

export default SessionUsageBadge
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
