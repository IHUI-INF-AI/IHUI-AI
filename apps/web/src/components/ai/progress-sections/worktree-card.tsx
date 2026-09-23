// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D72 Worktree 生命周期对话流卡(G-99) —— 对话流内渲染件。
//
// **数据面纪律(台账 D72 明文)**:本卡**不取数**。web 侧当前**没有** worktree 数据面
// (无 API 路由、无 SSE 帧),故事件由调用方注入(`onAction` 回调,卡片自己不 fetch);
// 八态判定一律走 `@ihui/shared/chat/worktree-lifecycle` —— 与 §12d 收编流程同源,
// 端内不得另建第二套 worktree 状态判定。
//
// 三个恢复入口:`timeout`(带"请检查仓库状态",不得只显示"超时")/ `initFailed` /
// `cleaned` 都给出恢复入口,`cleaned` 额外给磁盘回收入口;**`restoreFailed` 必须
// 显式渲染**(静默留空 = 把"无法恢复"伪装成"一切正常")。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  worktreeView,
  type WorktreeAction,
  type WorktreeLifecycleEvent,
  type WorktreeState,
  type WorktreeTone,
} from '@ihui/shared/chat/worktree-lifecycle'

/** 语义色档 → 样式(判定层只给语义,端内只做这一处样式映射) */
const TONE_CLASS: Record<WorktreeTone, string> = {
  neutral: 'text-muted-foreground',
  success: 'text-emerald-600 dark:text-emerald-500',
  warning: 'text-amber-600 dark:text-amber-500',
  danger: 'text-destructive',
}

export interface WorktreeCardProps {
  /** 生命周期事件(数据面接入前由调用方构造);缺省 ⇒ 本卡不渲染任何内容 */
  event?: WorktreeLifecycleEvent
  /** 动作回调。**数据面在调用方**,本卡只负责触发;不传则不渲染动作行 */
  onAction?: (action: WorktreeAction) => void
  className?: string
  'data-testid'?: string
}

export function WorktreeCard({
  event,
  onAction,
  className,
  'data-testid': testId,
}: WorktreeCardProps) {
  const t = useTranslations('ai.pane.worktree')

  const view = worktreeView(event)
  if (!view) return null

  const stateLabel: Record<WorktreeState, string> = {
    creating: t('state.creating'),
    ready: t('state.ready'),
    initFailed: t('state.initFailed'),
    timeout: t('state.timeout'),
    cleaned: t('state.cleaned'),
    restoring: t('state.restoring'),
    restored: t('state.restored'),
    restoreFailed: t('state.restoreFailed'),
  }
  const actionLabel: Record<WorktreeAction, string> = {
    restore: t('action.restore'),
    retryRestore: t('action.retryRestore'),
    reclaimDisk: t('action.reclaimDisk'),
    dismiss: t('action.dismiss'),
  }

  // 恢复入口:恢复失败走"重试恢复",其余恢复类走"恢复"(入口可见性由判定层决定)
  const restoreAction: WorktreeAction = view.state === 'restoreFailed' ? 'retryRestore' : 'restore'

  return (
    <div
      role="group"
      aria-label={t('ariaLabel')}
      className={cn('flex flex-col gap-2 rounded-md bg-muted/30 p-3', className)}
      data-testid={testId}
      data-worktree-state={view.state}
      data-worktree-tone={view.tone}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t('title')}</span>
        <span
          className={cn('text-xs font-medium', TONE_CLASS[view.tone])}
          data-worktree-state-label={view.state}
        >
          {stateLabel[view.state]}
        </span>
        {event?.branch ? (
          <span className="text-[11px] tabular-nums text-muted-foreground" data-worktree-branch={event.branch}>
            {event.branch}
          </span>
        ) : null}
        {event?.path ? (
          <span className="truncate text-[11px] text-muted-foreground/70" data-worktree-path={event.path}>
            {event.path}
          </span>
        ) : null}
      </div>

      {event?.reason ? (
        <p className="text-[11px] text-muted-foreground/70" data-worktree-reason={event.reason}>
          {event.reason}
        </p>
      ) : null}

      {view.hintKey ? (
        <p
          className={cn(
            'text-[11px]',
            view.tone === 'warning' || view.tone === 'danger'
              ? TONE_CLASS[view.tone]
              : 'text-muted-foreground',
          )}
          data-worktree-hint={view.hintKey}
        >
          {view.hintKey === 'hint.timeout'
            ? t('hint.timeout')
            : view.hintKey === 'hint.cleaned'
              ? t('hint.cleaned')
              : t('hint.singleWriter')}
        </p>
      ) : null}

      {onAction ? (
        <div className="flex flex-wrap items-center gap-1">
          {view.showRestore ? (
            <button
              type="button"
              onClick={() => onAction(restoreAction)}
              data-action={restoreAction}
              className="rounded-sm bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {actionLabel[restoreAction]}
            </button>
          ) : null}
          {view.showReclaim ? (
            <button
              type="button"
              onClick={() => onAction('reclaimDisk')}
              data-action="reclaimDisk"
              className="rounded-sm bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {actionLabel.reclaimDisk}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onAction('dismiss')}
            data-action="dismiss"
            className="rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
          >
            {actionLabel.dismiss}
          </button>
        </div>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
