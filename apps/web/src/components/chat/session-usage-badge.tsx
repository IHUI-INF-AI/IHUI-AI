// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Coins, Loader2 } from 'lucide-react'

import {
  getAgentTokenUsage,
  getModelPriceCny,
  getTokenBalance,
  type AgentTokenUsageSummary,
  type ModelPriceCny,
  type TokenBalance,
} from '@ihui/api-client'
import { Tooltip } from '@/components/feedback'
import { formatNumber } from '@/lib/date-utils'
import { cn } from '@/lib/utils'

export interface SessionUsageBadgeProps {
  /** 当前会话 ID(为空 = 新对话,不渲染) */
  conversationId: string | null
  /** 是否流式中:流式 SSE 无 usage 事件,结束(true→false)后拉端点刷新 */
  isStreaming: boolean
  /** 当前会话模型(W4 成本真网计价):据此查真实价目表;缺省 / 'auto' / 未收录 → 不显示 ¥ */
  model?: string
}

/**
 * 会话累计 Token / 费用紧凑徽章(2026-09-07 工作线 A;2026-09-12 W4 成本真网计价)。
 * 挂载于 AI 面板 header(标题右侧):显示当前会话累计 token;若当前 model 命中真实价目表
 * (GET /api/ai-pricing,分/千 token 整数、CNY),则按输入/输出分别折算并展示合计 ¥,
 * hover 展开明细(输入 / 输出 / 请求数 / 输入费用 / 输出费用 / 计价口径)。
 * 模型未收录、为 'auto' 或接口不可用时,仅显示 token 数、不显示 ¥(绝不回退固定常数)。
 */
export function SessionUsageBadge({ conversationId, isStreaming, model }: SessionUsageBadgeProps) {
  const t = useTranslations('chat.sessionUsage')
  const [usage, setUsage] = React.useState<AgentTokenUsageSummary | null>(null)
  const [loading, setLoading] = React.useState(false)
  // W4:当前模型真实单价(元/千 token);null = 未命中 / 非 CNY / 接口不可用 → 不展示 ¥
  const [price, setPrice] = React.useState<ModelPriceCny | null>(null)
  // #26(2026-09-13):用户 Token 余额/月配额(GET /api/user/token-balance);接口不可用 → null 不展示
  const [quota, setQuota] = React.useState<TokenBalance | null>(null)

  const refresh = React.useCallback(async (id: string) => {
    setLoading(true)
    try {
      const [summary, balanceRes] = await Promise.all([
        getAgentTokenUsage(id),
        getTokenBalance().catch(() => null),
      ])
      setUsage(summary.totalTokens > 0 ? summary : null)
      setQuota(balanceRes?.success ? (balanceRes.data ?? null) : null)
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
      setQuota(null)
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

  // W4:模型变化 → 查真实价目表;竞态用 cancelled 丢弃过期结果
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const p = await getModelPriceCny(model ?? '')
        if (!cancelled) setPrice(p)
      } catch {
        if (!cancelled) setPrice(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [model])

  if (!conversationId || !usage) return null

  // W4:输入/输出分别按各自单价折算(单价单位:元/千 token);价目缺失则整体不显示 ¥
  const inputCost = price ? (usage.promptTokens / 1000) * price.inputPricePer1kCny : null
  const outputCost = price ? (usage.completionTokens / 1000) * price.outputPricePer1kCny : null
  const totalCost = inputCost !== null && outputCost !== null ? inputCost + outputCost : null

  // #26(2026-09-13 立):月配额使用率 = 1 - 余额/月配额;无月配额(未配 VIP/接口缺失)为 null。
  // 分级告警沿用 context-usage-ring 的 used 阈值口径:≥0.95 红 / ≥0.8 橙 / ≥0.5 琥珀
  const monthlyQuota = quota ? (typeof quota.monthlyQuota === 'number' ? quota.monthlyQuota : 0) : 0
  const quotaUsedRatio =
    monthlyQuota > 0 && quota ? Math.min(1, Math.max(0, 1 - quota.balance / monthlyQuota)) : null
  const quotaBarClass =
    quotaUsedRatio === null
      ? null
      : quotaUsedRatio >= 0.95
        ? 'bg-red-500'
        : quotaUsedRatio >= 0.8
          ? 'bg-orange-500'
          : quotaUsedRatio >= 0.5
            ? 'bg-amber-500'
            : 'bg-primary'
  const quotaTextClass =
    quotaUsedRatio === null
      ? 'text-muted-foreground'
      : quotaUsedRatio >= 0.95
        ? 'text-red-500'
        : quotaUsedRatio >= 0.8
          ? 'text-orange-500'
          : quotaUsedRatio >= 0.5
            ? 'text-amber-500'
            : 'text-muted-foreground'
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
          {/* #26:用户 Token 余额/月配额行(接口可用且 vipLevel 缺省时不展示折扣) */}
          {quota && (
            <>
              <span className="tabular-nums">
                {t('balance')}: {formatNumber(quota.balance)}
                {typeof quota.monthlyQuota === 'number' && quota.monthlyQuota > 0
                  ? ` / ${formatNumber(quota.monthlyQuota)}`
                  : ''}
              </span>
              {/* #26:月配额余量进度条 + 使用率百分比(仅当月配额有效) */}
              {quotaUsedRatio !== null && (
                <div className="mt-1 w-44">
                  <div className="h-1.5 w-full overflow-hidden rounded-sm bg-muted-foreground/20">
                    <div
                      className={cn('h-full rounded-sm transition-all', quotaBarClass)}
                      style={{
                        width: `${Math.max(2, Math.round(quotaUsedRatio * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="tabular-nums text-[10px]">
                    {t('quotaUsedPercent', { percent: Math.round(quotaUsedRatio * 100) })}
                  </span>
                </div>
              )}
              {typeof quota.discountRate === 'number' && quota.discountRate < 1 && (
                <>
                  <span className="tabular-nums">
                    {t('vipDiscount', {
                      level: quota.vipLevel ?? 0,
                      rate: Math.round(quota.discountRate * 100),
                    })}
                  </span>
                  {quota.isPromotionPeriod && (
                    <span className="text-muted-foreground">{t('promotionHint')}</span>
                  )}
                </>
              )}
            </>
          )}
          {inputCost !== null && outputCost !== null ? (
            <>
              <span className="tabular-nums">
                {t('inputCost')}: ¥{inputCost.toFixed(3)}
              </span>
              <span className="tabular-nums">
                {t('outputCost')}: ¥{outputCost.toFixed(3)}
              </span>
              <span className="text-muted-foreground">{t('pricingHint')}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{t('noPriceHint')}</span>
          )}
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
        {totalCost !== null ? (
          <span className="whitespace-nowrap text-foreground">¥{totalCost.toFixed(3)}</span>
        ) : null}
        {/* #26:badge 本体直接展示月配额使用率,分级变色(≥0.5 琥珀 / ≥0.8 橙 / ≥0.95 红) */}
        {quotaUsedRatio !== null && (
          <span
            data-testid="session-usage-quota-percent"
            className={cn('whitespace-nowrap font-semibold', quotaTextClass)}
          >
            {Math.round(quotaUsedRatio * 100)}%
          </span>
        )}
      </span>
    </Tooltip>
  )
}

export default SessionUsageBadge
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
