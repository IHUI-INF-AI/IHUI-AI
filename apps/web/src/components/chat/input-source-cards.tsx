// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D89 输入源与队列小项打包 —— 纯展示三小卡(G-119/G-121/G-122,2026-09-24 立)。
//
// **数据面纪律(同 D72 worktree-card)**:三张卡**不取数**。状态与计数全部由调用方
// 注入(props),判定一律走 `@ihui/shared/chat/input-sources`,端内不得另建第二套
// 判定;动作通过回调上抛,卡片自己不 fetch、不写任何队列/快照状态。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Camera, ListPlus, Bookmark } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  QUEUE_COMMANDS,
  SNAPSHOT_STATES,
  UNDO_RESTORE_PHASES,
  attachAppView,
  firstRunGuideNeeded,
  goalAchievementView,
  memoryRefCountView,
  snapshotView,
  undoRestoreView,
  type SnapshotState,
  type UndoRestorePhase,
  type UndoVariant,
} from '@ihui/shared/chat/input-sources'

// ---------------------------------------------------------------------------
// ① 智能快照卡
// ---------------------------------------------------------------------------

export interface SnapshotSourceCardProps {
  /** 快照三态(disabled/enabled/failed),由调用方按真实能力状态注入 */
  state: SnapshotState
  /** 当前应用名(有值才渲染「附加 {appName}」片段) */
  appName?: string
  /** 首次使用引导是否已展示过(调用方负责记忆,只出一次) */
  guidedBefore?: boolean
  /** 启用/重试回调;不传则不渲染动作按钮(纯展示) */
  onToggle?: () => void
  className?: string
  'data-testid'?: string
}

export function SnapshotSourceCard({
  state,
  appName,
  guidedBefore = false,
  onToggle,
  className,
  'data-testid': testId,
}: SnapshotSourceCardProps) {
  const t = useTranslations('ai.pane.inputSources.snapshot')
  const view = snapshotView(state)
  const attach = attachAppView(appName ?? '')
  const guideNeeded = firstRunGuideNeeded(state, { guidedBefore })

  return (
    <div
      role="group"
      className={cn('flex flex-col gap-1.5 rounded-md bg-muted/30 p-3', className)}
      data-testid={testId}
      data-input-source="snapshot"
      data-snapshot-state={view.state}
      data-snapshot-tone={view.tone}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Camera className="h-3.5 w-3.5 shrink-0" />
        <span data-snapshot-label={view.state}>{t(view.labelKey)}</span>
      </div>
      {attach ? (
        <span className="text-xs text-muted-foreground" data-snapshot-app={attach.values.appName}>
          {t('attachApp', { appName: attach.values.appName })}
        </span>
      ) : null}
      {guideNeeded ? (
        <div className="rounded-sm bg-primary/5 px-2 py-1" data-snapshot-guide="first-run">
          <p className="text-xs font-medium text-primary">{t('firstRunGuideTitle')}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t('firstRunGuideBody')}</p>
        </div>
      ) : null}
      {view.hintKey ? (
        <p className="text-[11px] text-destructive" data-snapshot-hint={view.hintKey}>
          {t(view.hintKey)}
        </p>
      ) : null}
      {onToggle && view.actionKey ? (
        <button
          type="button"
          onClick={onToggle}
          data-action={view.actionKey}
          className="self-start rounded-sm bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {t(view.actionKey)}
        </button>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ② 队列命令卡 + Undo 行
// ---------------------------------------------------------------------------

export interface QueueCommandCardProps {
  /** Undo 恢复相位;缺省 = 无恢复之事,不渲染 Undo 行 */
  undoPhase?: UndoRestorePhase
  /** Undo 文案变体(queue=队列 / queued=排队),缺省 queue */
  undoVariant?: UndoVariant
  /** 命令点击回调(入队/插话由调用方走既有通道,本卡不写队列);不传则命令只读 */
  onCommand?: (id: (typeof QUEUE_COMMANDS)[number]['id']) => void
  className?: string
  'data-testid'?: string
}

export function QueueCommandCard({
  undoPhase,
  undoVariant = 'queue',
  onCommand,
  className,
  'data-testid': testId,
}: QueueCommandCardProps) {
  const t = useTranslations('ai.pane.inputSources')

  return (
    <div
      role="group"
      className={cn('flex flex-col gap-1.5 rounded-md bg-muted/30 p-3', className)}
      data-testid={testId}
      data-input-source="queue"
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ListPlus className="h-3.5 w-3.5 shrink-0" />
        <span>{t('ariaLabel')}</span>
      </div>
      <div className="flex flex-col gap-1">
        {QUEUE_COMMANDS.map((cmd) => (
          <button
            key={cmd.id}
            type="button"
            disabled={!onCommand}
            onClick={onCommand ? () => onCommand(cmd.id) : undefined}
            data-command={cmd.id}
            data-command-semantic={cmd.semantic}
            title={t(cmd.descKey)}
            className="flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-left text-xs text-foreground transition-colors hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
          >
            <span data-command-label={cmd.id}>{t(cmd.labelKey)}</span>
          </button>
        ))}
      </div>
      {undoPhase ? (
        (() => {
          const undo = undoRestoreView(undoPhase, undoVariant)
          return (
            <p
              className={cn(
                'text-[11px]',
                undo.tone === 'success'
                  ? 'text-emerald-600 dark:text-emerald-500'
                  : undo.tone === 'danger'
                    ? 'text-destructive'
                    : 'text-muted-foreground',
              )}
              data-undo-phase={undo.phase}
              data-undo-label={undo.labelKey}
            >
              {t(undo.labelKey)}
            </p>
          )
        })()
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ③ 记忆引用计数卡(含 goal 成就耗时行)
// ---------------------------------------------------------------------------

export interface MemoryRefCardProps {
  /** 记忆引用条数(0/非法 ⇒ 空态,不显示「0 条」) */
  count: number
  /** goal 成就耗时毫秒数;缺省 = 不渲染耗时行 */
  totalTimeMs?: number
  className?: string
  'data-testid'?: string
}

export function MemoryRefCard({ count, totalTimeMs, className, 'data-testid': testId }: MemoryRefCardProps) {
  const t = useTranslations('ai.pane.inputSources')
  const refs = memoryRefCountView(count)
  const goal = totalTimeMs === undefined ? null : goalAchievementView(totalTimeMs)

  return (
    <div
      role="group"
      className={cn('flex flex-col gap-1.5 rounded-md bg-muted/30 p-3', className)}
      data-testid={testId}
      data-input-source="memory"
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Bookmark className="h-3.5 w-3.5 shrink-0" />
        <span
          data-memory-ref-count={refs.values.count}
          data-memory-ref-empty={refs.empty ? 'true' : 'false'}
          title={refs.tooltipKey ? t(refs.tooltipKey) : undefined}
        >
          {t(refs.labelKey, { count: refs.values.count })}
        </span>
      </div>
      {goal ? (
        <div
          className="flex items-center gap-1 rounded-sm bg-primary/5 px-2 py-1 text-xs text-primary"
          data-goal-achieved={goal.labelKey}
        >
          {t(goal.labelKey, { totalTime: goal.values.totalTime })}
        </div>
      ) : null}
    </div>
  )
}

// 导出类型供调用方复用(判定层常量同步透出,渲染层不得自建第二套集合)
export { SNAPSHOT_STATES, UNDO_RESTORE_PHASES }
// ⁠[tail-watermark-placeholder]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
