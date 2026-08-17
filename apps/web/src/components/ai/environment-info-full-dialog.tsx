'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  GitBranch,
  GitCommit,
  FolderGit2,
  Globe,
  ArrowUp,
  ArrowDownToLine,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/feedback'
import { useEnvironmentInfoStore } from '@/stores/environment-info'
import { useAiPanelStore } from '@/stores/ai-panel'
import type { GitStatusSnapshot } from '@ihui/types'

/**
 * EnvironmentInfoFullDialog — 环境信息完整详情(2026-08-17 Phase5,方案 A:全屏 Dialog)。
 *
 * 触发:环境信息弹窗 header 右侧 "+" → store.fullViewOpen。
 * 展示(比 popover 更完整):
 * - 工作区路径(localPath,后端 /git/status 返回)
 * - 远程仓库列表(remotes[],含 fetch/push 类型)
 * - 当前分支 + ahead/behind
 * - 最近提交(lastCommit)
 * - 变更分桶(counts)
 * - PR 状态(pullRequest)
 * - 刷新按钮 + 关闭
 */
export function EnvironmentInfoFullDialog() {
  const t = useTranslations('aiChat.envInfo')
  const tcommon = useTranslations('common')
  const open = useEnvironmentInfoStore((s) => s.fullViewOpen)
  const closeFullView = useEnvironmentInfoStore((s) => s.closeFullView)
  const snapshot = useEnvironmentInfoStore((s) => s.snapshot)
  const loading = useEnvironmentInfoStore((s) => s.loading)
  const error = useEnvironmentInfoStore((s) => s.error)
  const fetchStatus = useEnvironmentInfoStore((s) => s.fetchStatus)
  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)

  const workspacePath = activeWorkspace?.path ?? null

  return (
    <Modal
      open={open}
      onClose={closeFullView}
      title={t('fullTitle')}
      description={workspacePath ?? undefined}
      size="full"
      className="max-h-[80vh] overflow-hidden"
      footer={
        <button
          type="button"
          onClick={() => closeFullView()}
          className="inline-flex h-8 items-center justify-center rounded-md bg-foreground px-4 text-xs font-medium text-background transition-opacity hover:opacity-90"
          data-testid="env-full-close"
        >
          {tcommon('close')}
        </button>
      }
    >
      <div className="flex h-full flex-col gap-3 overflow-y-auto pr-1 text-xs">
        {/* 工具栏:刷新 + 状态 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchStatus(workspacePath)}
            disabled={loading || !workspacePath}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
            data-testid="env-full-refresh"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} aria-hidden />
            {t('refresh')}
          </button>
          {loading && (
            <span className="flex items-center gap-1 text-muted-foreground/70">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              {t('loading')}
            </span>
          )}
          {error && <span className="text-[11px] text-destructive">{error}</span>}
        </div>

        {/* 主体内容 */}
        {!workspacePath && (
          <div className="py-8 text-center text-muted-foreground/70" data-testid="env-full-no-workspace">
            {t('noWorkspace')}
          </div>
        )}
        {workspacePath && !snapshot && !loading && !error && (
          <div className="py-8 text-center text-muted-foreground/70" data-testid="env-full-empty">
            {t('loading')}
          </div>
        )}
        {workspacePath && snapshot && (
          <FullBody snapshot={snapshot} workspacePath={workspacePath} t={t} />
        )}
      </div>
    </Modal>
  )
}

function FullBody({
  snapshot,
  workspacePath,
  t,
}: {
  snapshot: GitStatusSnapshot
  workspacePath: string
  t: ReturnType<typeof useTranslations<'aiChat.envInfo'>>
}) {
  if (!snapshot.isRepo) {
    return (
      <div className="py-8 text-center text-muted-foreground/70" data-testid="env-full-not-repo">
        {t('notRepo')}
      </div>
    )
  }
  const counts = snapshot.counts
  const totalChanges =
    counts.added + counts.modified + counts.deleted + counts.untracked + counts.conflicted + counts.renamed
  return (
    <div className="flex flex-col gap-3">
      {/* 工作区路径 */}
      <Section title={t('workspace')} icon={<FolderGit2 className="h-3.5 w-3.5" aria-hidden />}>
        <div
          className="break-all rounded-md bg-muted/40 px-2 py-1.5 font-mono text-[11px] text-foreground/80"
          data-testid="env-full-localpath"
        >
          {workspacePath}
        </div>
      </Section>

      {/* 远程仓库 */}
      <Section title={t('remotes')} icon={<Globe className="h-3.5 w-3.5" aria-hidden />}>
        {snapshot.remotes && snapshot.remotes.length > 0 ? (
          <div className="flex flex-col gap-1">
            {snapshot.remotes.map((r, i) => (
              <div
                key={`${r.name}-${i}`}
                className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5"
                data-testid="env-full-remote"
              >
                <span className="shrink-0 font-medium text-foreground/80">{r.name}</span>
                <span className="truncate font-mono text-[11px] text-muted-foreground/80">{r.url}</span>
                {r.type && <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/60">{r.type}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground/60" data-testid="env-full-no-remotes">
            {t('noRemotes')}
          </div>
        )}
      </Section>

      {/* 分支 + ahead/behind */}
      <Section title={t('branchDetails')} icon={<GitBranch className="h-3.5 w-3.5" aria-hidden />}>
        <div className="grid grid-cols-2 gap-2">
          <InfoCard label={t('currentBranch')} value={snapshot.branch ?? t('detached')} testId="env-full-branch" />
          <InfoCard
            label={t('aheadBehind')}
            value={
              <span className="tabular-nums">
                <ArrowUp className="mr-0.5 inline h-3 w-3" aria-hidden />
                {snapshot.ahead}
                <ArrowDownToLine className="mx-0.5 inline h-3 w-3" aria-hidden />
                {snapshot.behind}
              </span>
            }
            testId="env-full-ahead-behind"
          />
        </div>
      </Section>

      {/* 最近提交 */}
      <Section title={t('lastCommitTitle')} icon={<GitCommit className="h-3.5 w-3.5" aria-hidden />}>
        {snapshot.lastCommit ? (
          <div className="rounded-md bg-muted/40 px-2 py-1.5" data-testid="env-full-lastcommit">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-primary">{snapshot.lastCommit.hash}</span>
              <span className="truncate text-foreground/80">{snapshot.lastCommit.message}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground/60">
              {snapshot.lastCommit.author} · {snapshot.lastCommit.date}
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground/60" data-testid="env-full-no-commit">
            {t('noCommit')}
          </div>
        )}
      </Section>

      {/* 变更 */}
      <Section title={t('changes')} icon={<DiffGlyph />}>
        <div className="grid grid-cols-3 gap-2" data-testid="env-full-changes">
          <InfoCard label={t('added')} value={`+${counts.added}`} accent="text-emerald-600 dark:text-emerald-400" />
          <InfoCard label={t('deleted')} value={`-${counts.deleted}`} accent="text-red-500 dark:text-red-400" />
          <InfoCard label={t('total')} value={String(totalChanges)} />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground/60">
          <span>{t('modified')}: {counts.modified}</span>
          <span>{t('untracked')}: {counts.untracked}</span>
          <span>{t('renamed')}: {counts.renamed}</span>
          <span>{t('conflicted')}: {counts.conflicted}</span>
        </div>
      </Section>

      {/* PR 状态 */}
      <Section title={t('pullRequest')} icon={<PrGlyph state={snapshot.pullRequest?.state ?? null} />}>
        {snapshot.pullRequest ? (
          <a
            href={snapshot.pullRequest.url ?? '#'}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-muted/40 px-2 py-1.5 text-foreground/80 transition-colors hover:bg-accent"
            data-testid="env-full-pr"
          >
            PR #{snapshot.pullRequest.number}: {snapshot.pullRequest.title}
          </a>
        ) : (
          <div className="text-muted-foreground/60" data-testid="env-full-no-pr">
            {snapshot.hasRemote ? t('prUnavailable') : t('prNoRemote')}
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  )
}

function InfoCard({
  label,
  value,
  accent,
  testId,
}: {
  label: string
  value: React.ReactNode
  accent?: string
  testId?: string
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5" data-testid={testId}>
      <span className="text-[10px] text-muted-foreground/60">{label}</span>
      <span className={cn('truncate font-medium text-foreground/85', accent)}>{value}</span>
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

function DiffGlyph() {
  return (
    <span className="relative inline-block h-3.5 w-3.5 text-muted-foreground/80" aria-hidden>
      <PlusMinusGlyph />
    </span>
  )
}

function PlusMinusGlyph() {
  return (
    <span className="flex items-center text-[10px] font-bold leading-none">
      <span className="text-emerald-600 dark:text-emerald-400">+</span>
      <span className="-ml-px text-red-500 dark:text-red-400">-</span>
    </span>
  )
}

export default EnvironmentInfoFullDialog
