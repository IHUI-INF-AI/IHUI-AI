// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D71 统一 Turn 状态徽章(G-97) —— 对话流内渲染件。
//
// **数据面纪律**:本徽章**不取数**、不推导状态。十态判定一律走
// `@ihui/shared/chat/turn-status` 的 `turnStatusView`(穷尽 switch 零 default),
// 端内不得再写 `state === 'thinking' ? … : …` 这类第二套判定。
//
// 两处真实缺口在这里补上渲染位:
//   · `waitingConfirm`(等待确认)—— 现状**无处可见**,是用户中断的直接成因;
//     徽章走 warning 色并渲染"等你确认"的说明句。
//   · `backgroundRunning`(后台执行中)—— 现状**无处可见**,是用户切走的直接成因;
//     徽章显式标注已转入后台,前台不再假装还在等它。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  turnStatusView,
  type TurnState,
  type TurnStatusAction,
  type TurnTone,
} from '@ihui/shared/chat/turn-status'

/** 语义色档 → 样式(判定层只给语义,端内只做这一处样式映射) */
const TONE_CLASS: Record<TurnTone, string> = {
  neutral: 'text-muted-foreground',
  info: 'text-sky-600 dark:text-sky-500',
  warning: 'text-amber-600 dark:text-amber-500',
  success: 'text-emerald-600 dark:text-emerald-500',
  danger: 'text-destructive',
}

export interface TurnStatusBadgeProps {
  /** 当前轮次状态(十态之一) */
  state: TurnState
  /** 动作回调。数据面在调用方,徽章只负责触发;不传则不渲染动作按钮 */
  onAction?: (action: TurnStatusAction) => void
  className?: string
  'data-testid'?: string
}

export function TurnStatusBadge({
  state,
  onAction,
  className,
  'data-testid': testId,
}: TurnStatusBadgeProps) {
  const t = useTranslations('ai.pane.turnStatus')

  const view = turnStatusView(state)
  // 动作位:进行中态给「停止」,失败给「重试」,已停止给「继续」;三者互斥
  const action: TurnStatusAction | null = view.showStop
    ? 'stop'
    : view.action === 'none'
      ? null
      : view.action

  return (
    <div
      role="status"
      aria-label={t(view.ariaKey)}
      className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-0.5', className)}
      data-testid={testId}
      data-turn-state={view.state}
      data-turn-tone={view.tone}
      data-turn-busy={view.busy ? 'true' : 'false'}
      data-turn-terminal={view.terminal ? 'true' : 'false'}
      data-turn-waits-user={view.waitsUser ? 'true' : 'false'}
      data-turn-off-turn={view.offTurn ? 'true' : 'false'}
    >
      <span className="text-[11px] text-muted-foreground" data-turn-title>
        {t('title')}
      </span>
      <span
        className={cn('text-xs font-medium', TONE_CLASS[view.tone])}
        data-turn-state-label={view.state}
      >
        {t(view.titleKey)}
      </span>

      {view.hintKey ? (
        <span className="text-[11px] text-muted-foreground/80" data-turn-hint={view.hintKey}>
          {t(view.hintKey)}
        </span>
      ) : null}

      {action && onAction ? (
        <button
          type="button"
          onClick={() => onAction(action)}
          data-action={action}
          className="rounded-sm bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {action === 'stop' ? t('action.stop') : action === 'retry' ? t('action.retry') : t('action.resume')}
        </button>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
