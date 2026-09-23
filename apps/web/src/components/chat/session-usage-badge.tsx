// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Building2, Coins, Loader2, Receipt, Zap } from 'lucide-react'

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
  /** D56③ 计费口径:按 token 还是按次(缺省不透出,保持旧徽章形态) */
  billingMode?: BillingMode
  /** D56③ 按次单价(元/次,仅 billingMode=per_request 时展示) */
  perRequestPriceCny?: number
  /** D56② 优先通道/速通生效中 */
  isExpressLane?: boolean
  /** D56④ 企业用量四分账(个人/团队/免费模型/计费组,缺省不展示) */
  enterpriseUsage?: EnterpriseUsageSlice[]
}

/** D56③ 计费口径:token = 按 Token 计费,per_request = 按次计费 */
export type BillingMode = 'token' | 'per_request'

/** D56④ 企业用量单账(used/quota 均为 token 数,percent 由 used/quota 派生) */
export interface EnterpriseUsageSlice {
  /** 分账键(personal/team/free/billing_group,未知键原样显示) */
  key: string
  /** 已用 */
  used: number
  /** 配额(<=0 时不算百分比,只显示已用) */
  quota: number
}

/** 模板插值 fallback({var} 替换,缺值保留原占位) */
export function interpolateTemplate(
  template: string,
  values?: Record<string, string | number>,
): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v: string | number | undefined = values[k]
    return v === undefined ? m : String(v)
  })
}

/**
 * 会话累计 Token / 费用紧凑徽章(2026-09-07 工作线 A)。
 * 挂载于 AI 面板 header(标题右侧):显示当前会话累计 token 与估算费用(¥),
 * hover 展开明细(输入 / 输出 / 请求数 / 估算口径)。数据源 checkpoint 逐轮估算,
 * 会话切换拉取一次;流式结束后再刷新兜底。
 */
export function SessionUsageBadge({
  conversationId,
  isStreaming,
  model,
  billingMode,
  perRequestPriceCny,
  isExpressLane = false,
  enterpriseUsage,
}: SessionUsageBadgeProps) {
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

  const cost = estimateCostCny(usage.totalTokens)

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

  // D56(2026-09-23 立):额度与权益元素族,全部可选 props,缺省保持旧徽章形态。
  // D56 英文过渡(词表释放后换中文键):packages/i18n 词表被占用,fallback 先用英文过渡
  // (见 D56 键清单 en 列),词表可用后换回中文;过渡串不得含充值/购买/付费/升级诱导。
  // 心智边界:所有 fallback 不得含 充值/购买/付费/升级/必须充值 等诱导,免费额度仍可继续使用。
  const pickText = (
    key: string,
    fallback: string,
    values?: Record<string, string | number>,
  ): string => {
    const raw: string = values
      ? t(key, values as Record<string, string | number | Date>)
      : (t(key) as unknown as string)
    if (raw === key) return interpolateTemplate(fallback, values)
    return raw
  }
  const expressLabel = pickText('expressLane', 'Express')
  const expressDetail = pickText('expressLaneDetail', 'Express lane active, no queue in busy hours')
  const billingTokenLabel = pickText('billingToken', 'Per token')
  const billingPerRequestLabel = pickText('billingPerRequest', 'Per request')
  const billingDetailToken = pickText(
    'billingDetailToken',
    'Billed per token, usage estimated, bill is authoritative',
  )
  const billingDetailPerRequest =
    billingMode === 'per_request' && typeof perRequestPriceCny === 'number'
      ? pickText(
          'billingDetailPerRequest',
          'Billed per request ¥{price}/request, usage estimated, bill is authoritative',
          {
            price: perRequestPriceCny.toFixed(2),
          },
        )
      : pickText(
          'billingDetailPerRequestNoPrice',
          'Billed per request, usage estimated, bill is authoritative',
        )
  const enterpriseTitle = pickText('enterpriseTitle', 'Enterprise usage')
  const freeHint = pickText('freeHint', 'Free quota remains available')
  const enterpriseSliceLabel = (key: string): string => {
    if (key === 'personal') return pickText('enterprisePersonal', 'Personal')
    if (key === 'team') return pickText('enterpriseTeam', 'Team')
    if (key === 'free') return pickText('enterpriseFree', 'Free models')
    if (key === 'billing_group') return pickText('enterpriseBillingGroup', 'Billing group')
    return key
  }
  const hasD56Extras =
    isExpressLane || billingMode !== undefined || (enterpriseUsage?.length ?? 0) > 0
  const enterpriseSlices: EnterpriseUsageSlice[] = enterpriseUsage ?? []
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
          <span className="text-muted-foreground">{t('estimateHint')}</span>
          {/* D56② 速通明细行(hover 展开,本体徽章见下方) */}
          {isExpressLane && (
            <span data-testid="session-usage-express-detail" className="tabular-nums">
              <span>{expressDetail}</span>
            </span>
          )}
          {/* D56③ 计费口径透出行 */}
          {billingMode !== undefined && (
            <span data-testid="session-usage-billing-detail" className="tabular-nums">
              <span>
                {billingMode === 'per_request' ? billingDetailPerRequest : billingDetailToken}
              </span>
            </span>
          )}
          {/* D56④ 企业用量四分账视图(hover 展开,每账一行用量条) */}
          {enterpriseSlices.length > 0 && (
            <div data-testid="session-usage-enterprise" className="mt-1 flex w-44 flex-col gap-1">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{enterpriseTitle}</span>
              </span>
              {enterpriseSlices.map((slice) => {
                const ratio =
                  slice.quota > 0 ? Math.min(1, Math.max(0, slice.used / slice.quota)) : null
                const percent = ratio === null ? null : Math.round(ratio * 100)
                return (
                  <div
                    key={slice.key}
                    data-testid={`session-usage-enterprise-${slice.key}`}
                    className="flex flex-col gap-0.5"
                  >
                    <span className="flex items-center justify-between gap-2 tabular-nums text-[10px]">
                      <span>{enterpriseSliceLabel(slice.key)}</span>
                      <span>
                        {formatNumber(slice.used)}
                        {slice.quota > 0 ? ` / ${formatNumber(slice.quota)}` : ''}
                      </span>
                    </span>
                    {ratio !== null && percent !== null && (
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-full overflow-hidden rounded-sm bg-muted-foreground/20">
                          <span
                            className="block h-full rounded-sm bg-primary transition-all"
                            style={{ width: `${Math.max(2, percent)}%` }}
                          />
                        </span>
                        <span
                          data-testid={`session-usage-enterprise-percent-${slice.key}`}
                          className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-primary/10 px-1 text-[10px] font-semibold leading-none tabular-nums text-foreground"
                        >
                          <span>{percent}%</span>
                        </span>
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {/* D56 心智边界锚点:有权益元素时明示免费仍可用,不暗示充值 */}
          {hasD56Extras && (
            <span data-testid="session-usage-free-hint" className="text-muted-foreground">
              <span>{freeHint}</span>
            </span>
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
        <span className="whitespace-nowrap text-foreground">¥{cost.toFixed(3)}</span>
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
        {/* D56② 速通徽章(确定性居中模板,琥珀底) */}
        {isExpressLane && (
          <span
            data-testid="session-usage-express"
            className="inline-flex h-4 min-w-4 items-center justify-center gap-0.5 rounded bg-amber-500/15 px-1 text-[10px] font-semibold leading-none tabular-nums text-amber-600 dark:text-amber-400"
          >
            <Zap className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>{expressLabel}</span>
          </span>
        )}
        {/* D56③ 计费口径微标(按 Token / 按次) */}
        {billingMode !== undefined && (
          <span
            data-testid="session-usage-billing-mode"
            className="inline-flex h-4 min-w-4 items-center justify-center gap-0.5 rounded bg-background px-1 text-[10px] font-medium leading-none tabular-nums text-muted-foreground"
          >
            <Receipt className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              {billingMode === 'per_request'
                ? billingPerRequestLabel +
                  (typeof perRequestPriceCny === 'number'
                    ? ` ¥${perRequestPriceCny.toFixed(2)}/request`
                    : '')
                : billingTokenLabel}
            </span>
          </span>
        )}
        {/* D56④ 企业用量总览微标(hover 看四分账) */}
        {enterpriseSlices.length > 0 && (
          <span
            data-testid="session-usage-enterprise-summary"
            className="inline-flex h-4 min-w-4 items-center justify-center gap-0.5 rounded bg-background px-1 text-[10px] font-medium leading-none tabular-nums text-muted-foreground"
          >
            <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>{enterpriseTitle}</span>
          </span>
        )}
      </span>
    </Tooltip>
  )
}

export default SessionUsageBadge
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
