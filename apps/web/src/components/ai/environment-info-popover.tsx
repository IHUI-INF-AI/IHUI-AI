'use client'

import * as React from 'react'
import {
  ArrowDownToLine,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  CircleArrowOutUpRight,
  GitBranch,
  GitCommit,
  GitCompare,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { useEnvironmentInfoStore } from '@/stores/environment-info'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useAgentProgressPaneStore } from '@/stores/agent-progress-pane'
import { runCommand } from '@ihui/api-client'
import type { GitStatusSnapshot } from '@ihui/types'

/**
 * EnvironmentInfoPopover — AI 面板右上角"环境信息"按钮对应的 popover(2026-08-17 立,对标 Cursor IDE 右上角 env info card)。
 *
 * 行为契约:
 * - 位置:AI 面板 header 下方右侧,与 AgentTaskProgressPane 同区域(z 略高)。
 * - 互斥:打开本 popover 时自动关闭 AgentTaskProgressPane,避免两个浮层重叠。
 * - 打开时自动 fetch 一次数据;header 提供手动刷新按钮。
 * - 无 active workspace → 渲染"未选择工作区"占位,不调 API。
 *
 * UI 渲染规则(对齐用户提供的 Cursor 截图):
 * - header:左 "环境信息" + 右刷新 + 折叠按钮
 * - 变更行:+N -M(加号绿、减号红,对标 git diff 语义)
 * - 本地行:分支名 + 折叠标记;点击展开 remote / ahead / behind
 * - 提交或推送行:action 按钮(有 ahead 可点,点击后展开 commit message 输入框)
 * - 拉取请求行:有 PR 显示 PR 信息;无 PR 显示"无法获取拉取请求状态"
 * - 比较分支行:跳转到 IDE code-changes tab
 */

type EnvT = ReturnType<typeof useTranslations<'aiChat.envInfo'>>

export function EnvironmentInfoPopover() {
  const t = useTranslations('aiChat.envInfo')
  const open = useEnvironmentInfoStore((s) => s.open)
  const snapshot = useEnvironmentInfoStore((s) => s.snapshot)
  const loading = useEnvironmentInfoStore((s) => s.loading)
  const error = useEnvironmentInfoStore((s) => s.error)
  const closePopover = useEnvironmentInfoStore((s) => s.closePopover)
  const fetchStatus = useEnvironmentInfoStore((s) => s.fetchStatus)
  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)

  const workspacePath = activeWorkspace?.path ?? null
  const hasWorkspace = !!workspacePath

  // 打开时:关闭 agent progress pane(互斥)+ 拉一次数据
  React.useEffect(() => {
    if (!open) return
    useAgentProgressPaneStore.getState().closePane()
    void fetchStatus(workspacePath)
  }, [open, workspacePath, fetchStatus])

  if (!open) return null

  return (
    <div
      data-testid="env-info-popover"
      className={cn(
        'absolute right-2 z-popover top-2',
        'flex w-[min(320px,calc(100%-16px))] flex-col overflow-hidden',
        'rounded-lg border border-border bg-popover text-popover-foreground shadow-lg',
      )}
      role="complementary"
      aria-label={t('ariaLabel')}
    >
      <PopoverHeader
        onClose={closePopover}
        onRefresh={() => fetchStatus(workspacePath)}
        refreshing={loading}
        t={t}
      />
      <div className="flex flex-col text-xs">
        {!hasWorkspace && <NoWorkspaceHint t={t} />}
        {hasWorkspace && error && (
          <ErrorHint message={error} onRetry={() => fetchStatus(workspacePath)} t={t} />
        )}
        {hasWorkspace && snapshot && (
          <PopoverBody snapshot={snapshot} workspacePath={workspacePath} onRefresh={() => fetchStatus(workspacePath)} t={t} />
        )}
        {hasWorkspace && loading && !snapshot && (
          <div
            className="flex items-center gap-1.5 px-3 py-4 text-muted-foreground/70"
            data-testid="env-info-loading"
          >
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            <span>{t('loading')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function PopoverHeader({
  onClose,
  onRefresh,
  refreshing,
  t,
}: {
  onClose: () => void
  onRefresh: () => void
  refreshing: boolean
  t: EnvT
}) {
  return (
    <div
      className="flex h-9 shrink-0 items-center gap-1.5 border-b border-border/60 bg-muted/40 px-3"
      data-testid="env-info-header"
    >
      <span className="flex-1 truncate text-[13px] font-medium text-foreground" data-testid="env-info-title">
        {t('title')}
      </span>
      <Tooltip content={t('refresh')}>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label={t('refresh')}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
          data-testid="env-info-refresh"
        >
          <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} aria-hidden />
        </button>
      </Tooltip>
      <Tooltip content={t('collapse')}>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('collapse')}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          data-testid="env-info-close"
        >
          <Minus className="h-3 w-3" aria-hidden />
        </button>
      </Tooltip>
    </div>
  )
}

function NoWorkspaceHint({ t }: { t: EnvT }) {
  return (
    <div className="px-3 py-4 text-center text-muted-foreground/70" data-testid="env-info-no-workspace">
      <p className="text-[12px]">{t('noWorkspace')}</p>
    </div>
  )
}

function ErrorHint({ message, onRetry, t }: { message: string; onRetry: () => void; t: EnvT }) {
  return (
    <div className="px-3 py-3" data-testid="env-info-error">
      <div className="text-[11px] font-medium text-destructive">{t('errorTitle')}</div>
      <div className="mt-1 break-all text-[11px] text-muted-foreground/80">{message}</div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex h-6 items-center gap-1 rounded border border-border px-2 text-[11px] text-foreground transition-colors hover:bg-accent"
        data-testid="env-info-error-retry"
      >
        <RefreshCw className="h-3 w-3" aria-hidden />
        {t('retry')}
      </button>
    </div>
  )
}

function PopoverBody({
  snapshot,
  workspacePath,
  onRefresh,
  t,
}: {
  snapshot: GitStatusSnapshot
  workspacePath: string
  onRefresh: () => void
  t: EnvT
}) {
  const [branchExpanded, setBranchExpanded] = React.useState(false)
  const [commitOpen, setCommitOpen] = React.useState(false)
  const [commitMsg, setCommitMsg] = React.useState('')
  const [pushing, setPushing] = React.useState(false)

  if (!snapshot.isRepo) {
    return (
      <div className="px-3 py-4 text-center text-muted-foreground/70" data-testid="env-info-not-repo">
        <p className="text-[12px]">{t('notRepo')}</p>
      </div>
    )
  }

  const branch = snapshot.branch ?? t('detached')
  const ahead = snapshot.ahead
  const behind = snapshot.behind
  const added = snapshot.counts.added
  const deleted = snapshot.counts.deleted
  const otherChanges =
    snapshot.counts.modified + snapshot.counts.untracked + snapshot.counts.conflicted + snapshot.counts.renamed
  const totalChanges = added + deleted + otherChanges

  const handleCommitPush = async () => {
    if (!commitMsg.trim()) return
    setPushing(true)
    try {
      const addRes = await runCommand({
        command: 'git add -A',
        workspacePath,
        mode: 'workspace-write',
        timeoutMs: 10000,
      })
      if (!addRes.success) throw new Error(addRes.error ?? 'git add 失败')
      const commitRes = await runCommand({
        command: `git commit -m "${commitMsg.trim().replace(/"/g, '\\"')}"`,
        workspacePath,
        mode: 'workspace-write',
        timeoutMs: 15000,
      })
      if (!commitRes.success) throw new Error(commitRes.error ?? 'git commit 失败')
      setCommitOpen(false)
      setCommitMsg('')
      // 本地无待推送提交且已配置远程 → 自动 push(对标 Cursor commit & push 一步到位)
      if (snapshot.ahead === 0 && snapshot.hasRemote) {
        const pushRes = await runCommand({
          command: 'git push origin HEAD',
          workspacePath,
          mode: 'workspace-write',
          timeoutMs: 30000,
        })
        if (pushRes.success) {
          toast.success(t('pushOk'))
        } else {
          toast.error(t('pushFail'))
        }
      } else if (!snapshot.hasRemote) {
        toast.success(t('commitNoRemote'))
      } else {
        toast.success(t('commitOk'))
      }
      onRefresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('commitFail'))
    } finally {
      setPushing(false)
    }
  }

  return (
    <>
      {/* 变更行 */}
      <Row
        icon={<DiffGlyph />}
        label={t('changes')}
        right={
          totalChanges === 0 ? (
            <span className="text-muted-foreground/50 tabular-nums" data-testid="env-info-changes-empty">
              {t('noChanges')}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 tabular-nums" data-testid="env-info-changes">
              <span className="text-emerald-600 dark:text-emerald-400" data-testid="env-info-added">
                +{added}
              </span>
              <span className="text-red-500 dark:text-red-400" data-testid="env-info-deleted">
                -{deleted}
              </span>
              {otherChanges > 0 && (
                <span className="text-muted-foreground/80" data-testid="env-info-other">
                  ~{otherChanges}
                </span>
              )}
            </span>
          )
        }
        testId="env-info-row-changes"
      />

      {/* 本地行(可展开) */}
      <button
        type="button"
        onClick={() => setBranchExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-accent/40"
        aria-expanded={branchExpanded}
        data-testid="env-info-row-branch"
      >
        <span className="text-muted-foreground/80">
          <GitBranch className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="flex-1 truncate text-[12px] text-foreground/80">{t('local')}</span>
        <span
          className="flex min-w-0 items-center gap-1 text-[12px] font-medium text-foreground"
          data-testid="env-info-branch"
        >
          <span className="truncate">{branch}</span>
          {branchExpanded ? (
            <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-hidden />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-hidden />
          )}
        </span>
      </button>
      {branchExpanded && (
        <div
          className="space-y-0.5 bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground/80"
          data-testid="env-info-branch-details"
        >
          <div className="flex items-center gap-1.5">
            <span className="shrink-0">{t('remote')}:</span>
            <span className="truncate">{snapshot.hasRemote ? t('remoteYes') : t('remoteNo')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="shrink-0">{t('aheadBehind')}:</span>
            <span className="tabular-nums">
              <ArrowUp className="mr-0.5 inline h-3 w-3" aria-hidden />
              {ahead}
              <ArrowDownToLine className="mx-0.5 inline h-3 w-3" aria-hidden />
              {behind}
            </span>
          </div>
          <div className="flex items-center gap-1.5" data-testid="env-info-last-commit">
            {snapshot.lastCommit ? (
              <>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground/60">
                  {snapshot.lastCommit.hash}
                </span>
                <span className="truncate">{truncate(snapshot.lastCommit.message, 40)}</span>
              </>
            ) : (
              <span className="truncate text-muted-foreground/60">{t('noCommit')}</span>
            )}
          </div>
        </div>
      )}

      {/* 提交或推送行 */}
      <button
        type="button"
        onClick={() => {
          if (totalChanges > 0 || ahead > 0) setCommitOpen((v) => !v)
        }}
        disabled={totalChanges === 0 && ahead === 0}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors',
          totalChanges === 0 && ahead === 0
            ? 'cursor-not-allowed opacity-50'
            : 'hover:bg-accent/40',
        )}
        data-testid="env-info-row-commit-push"
      >
        <span className="text-muted-foreground/80">
          <GitCommit className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="flex-1 truncate text-[12px] text-foreground/80">{t('commitPush')}</span>
        <ChevronDown
          className={cn('h-3 w-3 text-muted-foreground/70 transition-transform', commitOpen && 'rotate-180')}
          aria-hidden
        />
      </button>
      {commitOpen && (
        <div className="border-t border-border/40 px-3 py-2" data-testid="env-info-commit-input">
          <div className="flex items-center gap-1.5">
            <input
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCommitPush()
                if (e.key === 'Escape') setCommitOpen(false)
              }}
              placeholder={t('commitPlaceholder')}
              className="h-7 min-w-0 flex-1 rounded border border-border bg-background px-2 text-[11px] text-foreground outline-none focus:border-primary"
              data-testid="env-info-commit-msg"
            />
            <button
              type="button"
              onClick={() => void handleCommitPush()}
              disabled={!commitMsg.trim() || pushing}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded border border-border px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              data-testid="env-info-commit-submit"
            >
              {pushing ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <ArrowDownToLine className="h-3 w-3" aria-hidden />
              )}
              {t('commitPush')}
            </button>
          </div>
        </div>
      )}

      {/* PR 状态行 */}
      <PullRequestRow snapshot={snapshot} t={t} />

      {/* 比较分支行 */}
      <button
        type="button"
        onClick={() => {
          if (typeof window === 'undefined') return
          window.dispatchEvent(new CustomEvent('ihui:open-ide-tab', { detail: { tab: 'code-changes' } }))
        }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-accent/40"
        data-testid="env-info-row-compare"
      >
        <span className="text-muted-foreground/80">
          <GitCompare className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="flex-1 truncate text-[12px] text-foreground/80">{t('compareBranch')}</span>
        <CircleArrowOutUpRight className="h-3 w-3 text-muted-foreground/70" aria-hidden />
      </button>
    </>
  )
}

// ===== 子组件 =====

function Row({
  icon,
  label,
  right,
  testId,
}: {
  icon: React.ReactNode
  label: string
  right?: React.ReactNode
  testId?: string
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5" data-testid={testId}>
      <span className="text-muted-foreground/80">{icon}</span>
      <span className="flex-1 truncate text-[12px] text-foreground/80">{label}</span>
      {right && <span className="text-[12px]">{right}</span>}
    </div>
  )
}

function PullRequestRow({ snapshot, t }: { snapshot: GitStatusSnapshot; t: EnvT }) {
  const pr = snapshot.pullRequest
  if (pr) {
    return (
      <a
        href={pr.url ?? '#'}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 px-3 py-1.5 transition-colors hover:bg-accent/40"
        data-testid="env-info-row-pr"
      >
        <PrGlyph state={pr.state} />
        <span className="flex-1 truncate text-[12px] text-foreground/80">
          {pr.number ? `PR #${pr.number}` : t('pullRequest')}
          {pr.title ? `: ${truncate(pr.title, 26)}` : ''}
        </span>
        <CircleArrowOutUpRight className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-hidden />
      </a>
    )
  }
  const label = snapshot.hasRemote ? t('prUnavailable') : t('prNoRemote')
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground/70" data-testid="env-info-row-pr">
      <PrGlyph state={null} />
      <span className="flex-1 truncate text-[12px]">{label}</span>
    </div>
  )
}

function PrGlyph({ state }: { state: 'open' | 'merged' | 'closed' | 'draft' | null }) {
  const cls = cn(
    'h-3.5 w-3.5',
    state === 'open' && 'text-emerald-600 dark:text-emerald-400',
    state === 'merged' && 'text-violet-500 dark:text-violet-400',
    state === 'closed' && 'text-red-500 dark:text-red-400',
    (state === 'draft' || state === null) && 'text-muted-foreground/80',
  )
  return <GitCommit className={cls} aria-hidden />
}

/** 变更行图标:⊕ ⊖ 叠放(对齐 Cursor env card 的 plus/minus 组合) */
function DiffGlyph() {
  return (
    <span className="relative inline-block h-3.5 w-3.5 text-muted-foreground/80" aria-hidden>
      <Plus className="absolute left-0 top-0 h-3 w-3" />
      <Minus className="absolute bottom-0 right-0 h-3 w-3" />
    </span>
  )
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return `${s.slice(0, n - 1)}…`
}

export default EnvironmentInfoPopover
