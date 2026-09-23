// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Check, Loader2, Lock, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { DiffHunk } from '@/lib/hunk-diff'

/**
 * Hunk 级 diff 控制条(2026-09-18 立,W5:hunk 级接受/拒绝/部分应用)。
 *
 * 交互模型「先选择、再一次应用」:逐个 hunk 勾选/取消,点「应用所选」时以原始内容为基线
 * 重组出最终内容再落盘。不做逐 hunk 立即写盘 —— 逐次写盘会让后续 hunk 的基线失效。
 */

interface HunkHeaderProps {
  hunk: DiffHunk
  /** 全部 hunk 数,用于「改动 i/N」展示 */
  total: number
  accepted: boolean
  /** 是否已暂存进交付批次(锁定,不再参与 accepted 切换) */
  staged?: boolean
  /** 外部禁用(应用中等),与 staged 叠加 */
  disabled?: boolean
  onToggle: () => void
  onStage: () => void
  onUnstage: () => void
}

/** 单个 hunk 的小标题:勾选框 + 行号区间 + 增删统计 + 暂存按钮 + 状态 */
export function HunkHeader({
  hunk,
  total,
  accepted,
  staged = false,
  disabled,
  onToggle,
  onStage,
  onUnstage,
}: HunkHeaderProps) {
  const t = useTranslations('ai.pane')
  const rangeLabel =
    hunk.removed > 0
      ? `-${hunk.oldStartLine},${hunk.oldEndLine} +${hunk.newStartLine},${hunk.newEndLine}`
      : `+${hunk.newStartLine}`
  // staged 或外部禁用 → 勾选框锁定(与 Codex staged 语义一致:已暂存即锁定)
  const locked = Boolean(disabled) || staged
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1 text-[10px]',
        accepted ? 'bg-zinc-900 text-zinc-400' : 'bg-zinc-900/60 text-zinc-600',
        staged && 'opacity-60',
      )}
      data-testid={`diff-hunk-header-${hunk.id}`}
    >
      <input
        type="checkbox"
        checked={accepted}
        disabled={locked}
        onChange={onToggle}
        aria-label={accepted ? t('diffHunk.rejectBlock') : t('diffHunk.acceptBlock')}
        className={cn(
          'h-3 w-3 shrink-0 accent-green-600 disabled:cursor-not-allowed',
          staged && 'opacity-40 grayscale',
        )}
        data-testid={`diff-hunk-toggle-${hunk.id}`}
      />
      <span className="shrink-0 tabular-nums">
        {t('diffHunk.changeBlock', { index: hunk.id + 1, total })}
      </span>
      <span className="shrink-0 font-mono tabular-nums text-zinc-500">{rangeLabel}</span>
      <span className="shrink-0 tabular-nums text-green-500">+{hunk.added}</span>
      <span className="shrink-0 tabular-nums text-red-500">-{hunk.removed}</span>
      {/* D88:暂存 / 取消暂存 按钮(staged 后切换为还原) */}
      <button
        type="button"
        onClick={staged ? onUnstage : onStage}
        disabled={disabled}
        aria-label={staged ? t('diffHunk.unstageHunk') : t('diffHunk.stageHunk')}
        className={cn(
          'shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] transition-colors',
          staged
            ? 'text-amber-500 hover:bg-amber-500/15'
            : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        data-testid={`diff-hunk-stage-${hunk.id}`}
      >
        {staged ? t('diffHunk.unstageHunk') : t('diffHunk.stageHunk')}
      </button>
      <span
        className={cn(
          'ml-auto inline-flex shrink-0 items-center gap-1',
          staged ? 'text-amber-500' : accepted ? 'text-green-500' : 'text-zinc-500',
        )}
      >
        {staged ? (
          <Lock className="h-3 w-3" />
        ) : accepted ? (
          <Check className="h-3 w-3" />
        ) : (
          <X className="h-3 w-3" />
        )}
        <span>
          {staged
            ? t('diffHunk.staged')
            : accepted
              ? t('diffHunk.accepted')
              : t('diffHunk.rejected')}
        </span>
      </span>
    </div>
  )
}

interface HunkToolbarProps {
  acceptedCount: number
  total: number
  disabled?: boolean
  applying?: boolean
  onApplySelected: () => void
  onClearSelection: () => void
  onReset: () => void
}

/** hunk 选择工具条:「应用所选」为部分应用的唯一落盘入口;全量接受/拒绝仍在卡片 footer */
export function HunkToolbar({
  acceptedCount,
  total,
  disabled,
  applying,
  onApplySelected,
  onClearSelection,
  onReset,
}: HunkToolbarProps) {
  const t = useTranslations('ai.pane')
  const canApply = acceptedCount > 0 && acceptedCount < total && !disabled && !applying
  const linkCls =
    'shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50'
  return (
    <div
      className="flex flex-wrap items-center gap-2 bg-muted/30 px-3 py-2"
      data-testid="diff-hunk-toolbar"
    >
      <button
        type="button"
        onClick={onApplySelected}
        disabled={!canApply}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-medium',
          canApply
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-muted text-muted-foreground/60',
          'disabled:cursor-not-allowed',
        )}
        data-testid="diff-hunk-apply-selected"
      >
        {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        <span>
          {applying
            ? t('diffHunk.applyingSelected')
            : t('diffHunk.applySelected', { count: acceptedCount })}
        </span>
      </button>
      <span className="shrink-0 text-[10px] text-muted-foreground/70">
        {t('diffHunk.selectedSummary', { accepted: acceptedCount, total })}
      </span>
      <button type="button" onClick={onClearSelection} disabled={disabled} className={linkCls}>
        {t('diffHunk.clearSelection')}
      </button>
      <button type="button" onClick={onReset} disabled={disabled} className={linkCls}>
        {t('diffHunk.resetSelection')}
      </button>
    </div>
  )
}

export default HunkToolbar
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
