// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D102 对话移交工作树 · web 弹层(G-140,对标 Codex localConversation.moveToWorktree)。
//
// **数据面纪律**:本弹层**不取数** —— 分支名单 / worktree 能力检查由调用方注入
// (`precheck` + `localBranches` + `existingWorktreeBranches`),移交动作经 `onSubmit`
// 交回调用方;api 路由面接入前不 fetch。
// **判定纪律**:运行中禁止 / 前置三态 / 四条分支名校验 / 空态 / 提交门一律走
// `@ihui/shared/chat/move-to-worktree`(其运行判定复用 D71 `turn-status`),
// 端内不另立第二套判定;worktree 创建后的生命周期仍由 D72
// `worktree-lifecycle` 唯一裁决(本弹层不渲染八态)。

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ihui/ui-react'
import {
  MOVE_TO_WORKTREE_TARGETS,
  branchListView,
  submitView,
  validateWorktreeBranch,
  type MoveToWorktreePrecheck,
  type MoveToWorktreeTarget,
  type WorktreeBranchErrorKey,
} from '@ihui/shared/chat/move-to-worktree'
import type { TurnState } from '@ihui/shared/chat/turn-status'

export interface MoveToWorktreeDialogProps {
  open: boolean
  /** 当前 turn 状态(运行中禁止态判据;缺失不臆断) */
  turnState?: TurnState | null
  /** 当前对话所在分支名(副标题富文本插值) */
  branchName?: string
  /** 默认分支名(defaultBranchError 判据) */
  defaultBranch?: string | null
  /** 已有工作树的分支名单(existing 目标 + branchAlreadyExists 判据) */
  existingWorktreeBranches?: readonly string[]
  /** 本地分支名单(数据面接入前由调用方注入) */
  localBranches?: readonly string[] | null
  /** 能力前置检查三态(分支可用性),缺省 ready */
  precheck?: MoveToWorktreePrecheck
  /** 前置检查失败后的重试回调 */
  onRetry?: () => void
  /** 移交提交(target + 最终分支名) */
  onSubmit?: (target: MoveToWorktreeTarget, branch: string) => void
  onClose: () => void
}

const TARGET_LABEL_KEY: Record<MoveToWorktreeTarget, 'createNewLabel' | 'existingWorktreeLabel'> = {
  createNew: 'createNewLabel',
  existing: 'existingWorktreeLabel',
}

export function MoveToWorktreeDialog({
  open,
  turnState = null,
  branchName,
  defaultBranch = null,
  existingWorktreeBranches,
  localBranches,
  precheck = 'ready',
  onRetry,
  onSubmit,
  onClose,
}: MoveToWorktreeDialogProps) {
  const t = useTranslations('ai.pane.moveToWorktree')
  const [target, setTarget] = React.useState<MoveToWorktreeTarget>('createNew')
  const [branchInput, setBranchInput] = React.useState('')
  const [selectedExisting, setSelectedExisting] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setTarget('createNew')
    setBranchInput('')
    setSelectedExisting('')
  }, [open])

  const branch = target === 'createNew' ? branchInput : selectedExisting
  const view = submitView({
    turnState,
    precheck,
    target,
    branch,
    defaultBranch,
    existingWorktreeBranches,
  })

  const list = branchListView(precheck, localBranches)

  // 分支名即时校验(只报 validateWorktreeBranch 固定顺序的首条);
  // 空输入不即时报错 —— required 由 continue 门兜住,避免一打开就见红。
  const branchError: WorktreeBranchErrorKey | null =
    target === 'createNew' && branchInput.trim().length > 0
      ? validateWorktreeBranch(branchInput, {
          defaultBranch,
          existingBranches: existingWorktreeBranches,
        }).errorKey
      : null

  if (!open) return null

  const handleContinue = () => {
    if (!view.canContinue || branch.trim().length === 0) return
    onSubmit?.(target, branch.trim())
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <div
          data-testid="move-to-worktree-dialog"
          data-target={target}
          data-can-continue={String(view.canContinue)}
          data-precheck={precheck}
        >
          <DialogHeader>
            <DialogTitle data-slot="title">{t('title')}</DialogTitle>
            <DialogDescription data-slot="subtitle" data-branch={branchName}>
              {t.rich('subtitle', {
                branchName: branchName ?? '',
                branch: (chunks) => <code className="font-mono text-xs">{chunks}</code>,
              })}
            </DialogDescription>
          </DialogHeader>

          {view.blockKey === 'existingWorktreeRunning' ? (
            <p
              className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-500"
              data-block="existingWorktreeRunning"
            >
              {t('existingWorktreeRunning')}
            </p>
          ) : null}

          {precheck === 'loading' ? (
            <p
              className="flex items-center gap-2 py-2 text-sm text-muted-foreground"
              data-precheck-line="loading"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              <span>{t('loading')}</span>
            </p>
          ) : null}

          <fieldset className="space-y-1" data-slot="target-group">
            <legend className="text-xs font-medium text-muted-foreground" data-slot="target-label">
              {t('targetLabel')}
            </legend>
            <div className="flex gap-2" role="radiogroup" aria-label={t('targetLabel')}>
              {MOVE_TO_WORKTREE_TARGETS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={option === target}
                  data-target-option={option}
                  onClick={() => setTarget(option)}
                  className="rounded-md border px-3 py-1.5 text-sm transition-colors aria-checked:border-brand-accent-deep aria-checked:bg-primary/10"
                >
                  {t(TARGET_LABEL_KEY[option])}
                </button>
              ))}
            </div>
          </fieldset>

          {target === 'createNew' ? (
            <div className="space-y-2" data-slot="create-new-section">
              { }
              <label
                htmlFor="m2w-branch-input"
                className="text-xs font-medium"
                data-slot="branch-label"
              >
                {t('worktreeBranchLabel')}
              </label>
              <input
                id="m2w-branch-input"
                data-slot="branch-input"
                aria-label={t('worktreeBranchAriaLabel')}
                value={branchInput}
                onChange={(e) => setBranchInput(e.target.value)}
                className="w-full rounded-md border bg-transparent px-2 py-1.5 font-mono text-sm"
              />
              {branchError ? (
                <p className="text-xs text-destructive" data-branch-error={branchError}>
                  {t(branchError)}
                </p>
              ) : null}

              <div className="space-y-1" data-slot="local-checkout">
                <span className="text-xs text-muted-foreground" data-slot="local-checkout-label">
                  {t('localCheckoutLabel')}
                </span>
                {list.statusKey ? (
                  <div className="flex items-center gap-2">
                    <span
                      data-branches-status={list.statusKey}
                      className="text-xs text-muted-foreground"
                    >
                      {t(list.statusKey)}
                    </span>
                    {precheck === 'error' && onRetry ? (
                      <Button variant="outline" size="xs" data-action="retry" onClick={onRetry}>
                        {t('branchesRetry')}
                      </Button>
                    ) : null}
                  </div>
                ) : list.empty ? (
                  <p className="text-xs text-muted-foreground" data-empty="noTargetBranch">
                    {t('noTargetBranch')}
                  </p>
                ) : (
                  <select
                    data-slot="local-branch-select"
                    aria-label={t('localBranchPlaceholder')}
                    className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm"
                    defaultValue=""
                  >
                    <option value="">{t('localBranchPlaceholder')}</option>
                    {list.branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ) : (
            <div
              className="space-y-1"
              role="radiogroup"
              aria-label={t('existingWorktreeLabel')}
              data-slot="existing-list"
            >
              {(existingWorktreeBranches ?? []).map((b) => (
                <button
                  key={b}
                  type="button"
                  role="radio"
                  aria-checked={b === selectedExisting}
                  data-existing-branch={b}
                  onClick={() => setSelectedExisting(b)}
                  className="block w-full rounded-md border px-3 py-1.5 text-left font-mono text-xs transition-colors aria-checked:border-brand-accent-deep aria-checked:bg-primary/10"
                >
                  {b}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3">
            <Button variant="outline" size="sm" data-action="cancel" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              data-action="continue"
              disabled={!view.canContinue}
              onClick={handleContinue}
            >
              {t('continue')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default MoveToWorktreeDialog
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
