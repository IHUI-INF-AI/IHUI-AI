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
// 草稿保留提示(message-draft-preserved-${id})与 message-error-card-${id} 契约保留,便于 MessageItem 平滑替换。

import * as React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

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
  // onAddPoints / onUpgradePlan / onViewUsage 三枚动作在 `MessageErrorCardProps` 里仍是对外的
  // 契约面(调用方照传),但当前渲染分支只剩 onSwitchTier 一条出口 —— 参数解构里先不列它们,
  // 否则 `noUnusedLocals` 把整包 web typecheck 钉红。三枚动作是否要重新上屏属产品决策,
  // 已在计划登记,不得靠保留死参数假装"已接线"。
  onSwitchTier,
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

  return (
    <div
      data-testid={`message-error-card-${messageId}`}
      className="w-full overflow-hidden rounded-lg border border-destructive/40 bg-destructive/5"
    >
      <div className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-xs font-medium">{t('errorCardTitle')}</span>
      </div>

      <p className="whitespace-pre-wrap break-words px-3 py-2 text-sm text-destructive/90">
        {content.replace(/^⚠\s*/, '')}
      </p>

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
        <div className="px-3 pb-2">
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
