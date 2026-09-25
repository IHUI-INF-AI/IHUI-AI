// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D39 错误卡(2026-09-23 立)。
//
// 替代 MessageItem.tsx:728-764 的内联错误卡(该文件为并行会话只读禁区,本组件为其
// 收敛后的独立可测载体;接入点见交付报告接缝清单)。
//
// 三态可观测:倒计时(schedule)/ HTTP 状态 / 无响应超时 —— 全部消费 retryInfo 帧,缺失即降级。
// 额度型错误(quotaError)渲染动作族;非额度错误仅保留重试按钮。
// D67(2026-09-25 装车):同一分支上方再挂 QuotaOwnershipCard —— 归属四型的分型标题 /
// escalate 标记 / 降级建议 / 低峰折扣倒计时由它出,动作三件的出口复用本卡既有注入点。
// 草稿保留提示(message-draft-preserved-${id})与 message-error-card-${id} 契约保留,便于 MessageItem 平滑替换。

import * as React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

import { QuotaOwnershipCard } from '@/components/ai/quota-ownership-card'
import { fromErrorCode, type QuotaOwnershipAction } from '@ihui/shared/chat/quota-ownership'

import { QuotaActionFamily } from './QuotaActionFamily'
import {
  buildRetryCountdownView,
  useRetryCountdown,
  type RetryCountdownInfo,
  type TFunction,
} from './retry-countdown'

export interface MessageErrorCardProps {
  messageId: string
  /** 错误正文(已剥离 shared 层附加的 ⚠ 前缀) */
  content: string
  t: TFunction
  /** 重试(重发当前消息) */
  onRetry?: () => void
  /** 草稿保留提示文案(由调用方用 resolvePersistTexts 解析后传入,本组件不依赖 D60 内部类型) */
  draftPreservedText?: string | null
  /** D34 retry_scheduled 帧;null/缺失 = 优雅降级,不渲染倒计时块 */
  retryInfo?: RetryCountdownInfo | null
  /** 无响应超时(请求无 HTTP 响应而超时) */
  noResponseTimeout?: boolean
  /** D39 免费额度心智边界 */
  freeTierAvailable?: boolean
  /** 是否额度型错误(决定渲染额度动作族) */
  quotaError?: boolean
  /**
   * D67 额度归属分型的**唯一入口**:消息上的 D71 errorCode(如 BUDGET_EXHAUSTED)。
   * 归属四型由 shared 层 `fromErrorCode` 判定(先过 error-catalog 真相源闸,
   * 映射不到即 null ⇒ 分型卡不渲染),端内不得自建第二套归属判定。
   */
  errorCode?: string | null
  /**
   * 卡片标题(2026-09-25 加):宿主按 D92 统一分类表算出的标题时传入;
   * 不传 ⇒ 回落 `t('errorCardTitle')` 笼统标题。**回落态不得由本组件包装成确定性结论**,
   * 所以判"分类到没分类到"的权力留在宿主(它才拿得到 `resolveViewFailure` 的 isFallback)。
   */
  titleText?: string
  /**
   * 夹在"错误正文"与"倒计时/草稿/动作族"之间的宿主侧行(2026-09-25 加):
   * D92 的错误码行 + 建议动作、D94 的脱敏交接单都从这里进 —— 本组件不认识它们的键,
   * 也不另起一张表(判据留在有判据的地方)。
   */
  children?: React.ReactNode
  onAddPoints?: () => void
  onUpgradePlan?: () => void
  onSwitchTier?: () => void
  onViewUsage?: () => void
  onReLogin?: () => void
}

export function MessageErrorCard({
  messageId,
  content,
  t,
  onRetry,
  draftPreservedText,
  retryInfo,
  noResponseTimeout,
  freeTierAvailable,
  quotaError,
  errorCode,
  titleText,
  children,
  // onAddPoints / onReLogin 两枚动作在 `MessageErrorCardProps` 里仍是对外的
  // 契约面(调用方照传),但当前渲染分支没有它们的出口 —— 参数解构里先不列它们,
  // 否则 `noUnusedLocals` 把整包 web typecheck 钉红。两枚动作是否要重新上屏属产品决策,
  // 已在计划登记,不得靠保留死参数假装"已接线"。
  onSwitchTier,
  onViewUsage,
  onUpgradePlan,
  onReLogin,
}: MessageErrorCardProps) {
  // 帧缺失:retryInfo 为 null/undefined → remaining 无意义,view 为 null,倒计时块不渲染
  const remaining = useRetryCountdown(retryInfo?.retryInMs)
  const view =
    retryInfo !== null && retryInfo !== undefined
      ? buildRetryCountdownView(
          { ...retryInfo, noResponse: noResponseTimeout || retryInfo.noResponse },
          t,
          remaining,
        )
      : null
  const showRetryBlock =
    view !== null &&
    view !== undefined &&
    ((view.scheduleLabel !== null && view.scheduleLabel !== undefined) ||
      (view.httpStatusLabel !== null && view.httpStatusLabel !== undefined) ||
      (view.noResponseLabel !== null && view.noResponseLabel !== undefined))

  // D67 额度归属分型:errorCode → 四型由 shared 层唯一判定(映射不到 = null,分型卡自行不渲染)
  const ownershipKind = fromErrorCode(errorCode)
  /**
   * 分型动作族 → 本卡既有动作接缝(与 D39 动作族同一批注入点,不另开通道):
   *   viewUsage → onViewUsage / switchFreeModel → onSwitchTier / upgradeOrAdmin → onUpgradePlan
   * 穷尽三型、无 default:新增归属动作而漏接出口 ⇒ 编译期收窄失败。
   */
  const handleOwnershipAction = (action: QuotaOwnershipAction): void => {
    switch (action) {
      case 'viewUsage':
        onViewUsage?.()
        return
      case 'switchFreeModel':
        onSwitchTier?.()
        return
      case 'upgradeOrAdmin':
        onUpgradePlan?.()
        return
    }
  }
  // 一枚出口都没注入时不给 onAction —— 分型卡的动作行整体不渲染,免得摆三个点了没反应的按钮
  // (标题/降级建议/折扣仍照常渲染,那才是本票要的"分型上屏")。
  const hasOwnershipActions = Boolean(onViewUsage || onSwitchTier || onUpgradePlan)

  return (
    <div
      data-testid={`message-error-card-${messageId}`}
      className="w-full overflow-hidden rounded-lg border border-destructive/40 bg-destructive/5"
    >
      <div className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-xs font-medium">{titleText ?? t('errorCardTitle')}</span>
      </div>

      <p className="whitespace-pre-wrap break-words px-3 py-2 text-sm text-destructive/90">
        {content.replace(/^⚠\s*/, '')}
      </p>

      {children}

      {showRetryBlock && (
        <div
          data-testid={`message-error-retry-${messageId}`}
          className="flex flex-wrap items-center gap-2 px-3 pb-1 pt-0.5 text-xs text-muted-foreground"
        >
          {view!.scheduleLabel !== null && view!.scheduleLabel !== undefined && (
            <span data-testid="error-retry-schedule">{view!.scheduleLabel}</span>
          )}
          {view!.httpStatusLabel !== null && view!.httpStatusLabel !== undefined && (
            <span data-testid="error-retry-http">{view!.httpStatusLabel}</span>
          )}
          {view!.noResponseLabel !== null && view!.noResponseLabel !== undefined && (
            <span data-testid="error-retry-noresponse">{view!.noResponseLabel}</span>
          )}
        </div>
      )}

      {draftPreservedText ? (
        <p
          data-testid={`message-draft-preserved-${messageId}`}
          className="px-3 pb-2 text-xs text-muted-foreground"
        >
          {draftPreservedText}
        </p>
      ) : null}

      {quotaError ? (
        // 额度型错误:渲染动作族(含重试,复用 message-retry-${id} 契约便于平滑替换 MessageItem)
        <div className="flex flex-col gap-2 px-3 pb-2">
          {/*
            D67 分型卡:D39 动作族只说"额度用尽了",本卡说清"是谁的额度、下一步找谁"。
            显示门槛(仅当次请求因额度被拒)与付费动作剔除都由 shared 判定层把关,
            渲染层不复述判据 —— rejectedByQuota 刻意把 quotaError 与"errorCode 可归到额度型"
            两路并起来(宿主只传 errorCode 也应当上屏)。
          */}
          <QuotaOwnershipCard
            kind={ownershipKind}
            rejectedByQuota={quotaError === true || ownershipKind !== null}
            freeTierAvailable={freeTierAvailable}
            onAction={hasOwnershipActions ? handleOwnershipAction : undefined}
            data-testid={`message-quota-ownership-${messageId}`}
          />
          <QuotaActionFamily
            t={t}
            freeTierAvailable={freeTierAvailable}
            onRetry={onRetry}
            retryTestId={`message-retry-${messageId}`}
            onSwitchTier={onSwitchTier}
            addPointsHref="/points"
            upgradePlanHref="/vip"
            viewUsageHref="/models/usage"
            reLogin={onReLogin}
          />
        </div>
      ) : onRetry ? (
        // 非额度错误:仅保留重试按钮(沿用既有 message-retry-${id} 契约)
        <div className="px-3 pb-2 pt-0.5">
          <button
            type="button"
            onClick={onRetry}
            data-testid={`message-retry-${messageId}`}
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>{t('retry')}</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
