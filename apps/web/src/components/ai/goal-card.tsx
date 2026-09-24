// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Pause, Play, Plus, Target, Trash2, X, Zap } from 'lucide-react'

import { toast } from '@/components/common'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chat'
import { useGoalStore, type GoalStatus } from '@/stores/goal'

/**
 * GoalCard — /goal 会话目标卡片(W24,2026-09-14 立)。
 *
 * 展示当前会话目标的状态机全貌:目标文本 / 四态状态徽章 / 进度条 / 阻塞原因列表。
 * 操作:
 * - 进度 ±10(到达 100 自动提示标记完成)
 * - 添加 / 移除阻塞原因(首条阻塞自动切 blocked,清空自动恢复 active)
 * - 自动续跑:把续跑指令写入 draftInput + draftAutoSend,由 MessageInput 自动发送
 * - 暂停 / 继续 / 标记完成 / 清除
 */

const STATUS_BADGE: Record<GoalStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-600',
  paused: 'bg-amber-500/15 text-amber-600',
  blocked: 'bg-destructive/10 text-destructive',
  done: 'bg-primary/15 text-primary',
}

const STATUS_KEY: Record<GoalStatus, string> = {
  active: 'statusActive',
  paused: 'statusPaused',
  blocked: 'statusBlocked',
  done: 'statusDone',
}

/**
 * D89 ③(2026-09-24):goal 成就耗时条格式化。
 * 数据面:`useGoalStore` 的 `createdAt`(setGoal 时落定)与 `updatedAt`
 * (setStatus('done') 时刷新,见 stores/goal.ts)——`updatedAt - createdAt`
 * 即"达成目标耗时",无需新契约字段。单位串语言中立(h/m/s)。
 */
function formatGoalDuration(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000))
  const min = Math.floor(sec / 60)
  const h = Math.floor(min / 60)
  if (h > 0) return `${h}h ${min % 60}m`
  if (min > 0) return `${min}m ${sec % 60}s`
  return `${sec}s`
}

export function GoalCard() {
  const t = useTranslations('goalCard')
  const goal = useGoalStore((s) => s.goal)
  const advance = useGoalStore((s) => s.advance)
  const setProgress = useGoalStore((s) => s.setProgress)
  const addBlocker = useGoalStore((s) => s.addBlocker)
  const removeBlocker = useGoalStore((s) => s.removeBlocker)
  const setStatus = useGoalStore((s) => s.setStatus)
  const clear = useGoalStore((s) => s.clear)

  const [blockerDraft, setBlockerDraft] = React.useState('')

  if (!goal) {
    return (
      <div
        data-testid="goal-card-empty"
        className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground"
      >
        <p>{t('empty')}</p>
        <p className="mt-1 text-xs">{t('emptyHint')}</p>
      </div>
    )
  }

  /** 自动续跑:复用首页 CTA 的 draftAutoSend 通道,由 MessageInput 消费后自动发送 */
  const handleContinue = () => {
    const blockersText =
      goal.blockers.length > 0 ? `，${t('blockers')}: ${goal.blockers.join('; ')}` : ''
    const prompt = t('continuePrompt', {
      goal: goal.text,
      progress: goal.progress,
      blockers: blockersText,
    })
    useChatStore.setState({ draftInput: prompt, draftAutoSend: true })
    toast.success(t('continueQueued'))
  }

  const handleAddBlocker = () => {
    if (!blockerDraft.trim()) return
    addBlocker(blockerDraft)
    setBlockerDraft('')
  }

  return (
    <div data-testid="goal-card" className="space-y-3 rounded-lg border p-3 text-sm">
      {/* 目标文本 + 状态徽章 */}
      <div className="flex items-start gap-2">
        <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 break-words font-medium">{goal.text}</p>
        <span
          data-testid="goal-status-badge"
          className={cn(
            'shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium',
            STATUS_BADGE[goal.status],
          )}
        >
          {t(STATUS_KEY[goal.status])}
        </span>
      </div>

      {/* D89 ③:done 态成就耗时条(数据面=createdAt/updatedAt 差值) */}
      {goal.status === 'done' && (
        <div
          data-testid="goal-achieved-time"
          className="flex items-center gap-1.5 rounded-md bg-primary/5 px-2 py-1 text-xs text-primary"
        >
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span>
            {t('achievedInTime', {
              totalTime: formatGoalDuration(goal.updatedAt - goal.createdAt),
            })}
          </span>
        </div>
      )}

      {/* 进度条 + ±10 */}
      <div className="space-y-1.5" data-testid="goal-progress">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('progress')}</span>
          <span data-testid="goal-progress-value">{goal.progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-sm bg-muted">
          <div
            data-testid="goal-progress-bar"
            className="h-full rounded-sm bg-primary transition-all"
            style={{ width: `${goal.progress}%` }}
          />
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            data-testid="goal-progress-dec"
            onClick={() => advance(-10)}
            className="rounded-md border px-2 py-1 text-xs transition-colors hover:bg-accent"
          >
            -10
          </button>
          <button
            type="button"
            data-testid="goal-progress-inc"
            onClick={() => advance(10)}
            className="rounded-md border px-2 py-1 text-xs transition-colors hover:bg-accent"
          >
            +10
          </button>
          <button
            type="button"
            data-testid="goal-progress-set"
            onClick={() => setProgress(goal.progress >= 100 ? 0 : 100)}
            className="rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
          >
            {goal.progress >= 100 ? t('resetProgress') : t('fullProgress')}
          </button>
        </div>
      </div>

      {/* 阻塞原因 */}
      <div className="space-y-1.5" data-testid="goal-blockers">
        <p className="text-xs text-muted-foreground">
          {t('blockers')}
          {goal.blockers.length === 0 && <span className="ml-1">({t('noBlockers')})</span>}
        </p>
        {goal.blockers.map((b, i) => (
          <div
            key={`${i}-${b}`}
            data-testid={`goal-blocker-item-${i}`}
            className="flex items-center gap-1.5 rounded-md bg-destructive/5 px-2 py-1 text-xs"
          >
            <span className="min-w-0 flex-1 break-words text-destructive">{b}</span>
            <button
              type="button"
              data-testid={`goal-blocker-remove-${i}`}
              aria-label={t('blockerRemove')}
              onClick={() => removeBlocker(i)}
              className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <div className="flex gap-1.5">
          <input
            data-testid="goal-blocker-input"
            value={blockerDraft}
            onChange={(e) => setBlockerDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddBlocker()
              }
            }}
            placeholder={t('blockerPlaceholder')}
            className="min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            data-testid="goal-blocker-add"
            onClick={handleAddBlocker}
            className="flex shrink-0 items-center gap-0.5 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-accent"
          >
            <Plus className="h-3 w-3" />
            {t('blockerAdd')}
          </button>
        </div>
      </div>

      {/* 操作按钮行 */}
      <div className="flex flex-wrap gap-1.5 border-t pt-2">
        <button
          type="button"
          data-testid="goal-continue"
          onClick={handleContinue}
          className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Zap className="h-3 w-3" />
          {t('continue')}
        </button>
        {goal.status === 'paused' ? (
          <button
            type="button"
            data-testid="goal-resume"
            onClick={() => setStatus('active')}
            className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-accent"
          >
            <Play className="h-3 w-3" />
            {t('resume')}
          </button>
        ) : (
          <button
            type="button"
            data-testid="goal-pause"
            onClick={() => setStatus('paused')}
            className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-accent"
          >
            <Pause className="h-3 w-3" />
            {t('pause')}
          </button>
        )}
        <button
          type="button"
          data-testid="goal-done"
          onClick={() => setStatus('done')}
          className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-accent"
        >
          <CheckCircle2 className="h-3 w-3" />
          {t('done')}
        </button>
        <button
          type="button"
          data-testid="goal-clear"
          onClick={() => {
            clear()
            toast.success(t('cleared'))
          }}
          className="ml-auto flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
          {t('clear')}
        </button>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
