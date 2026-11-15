// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 变更请求面板(F-Forge,2026-11-13 立)
 *
 * 对标 DSH Forge 的「会话侧栏变更请求面板」,落点是 AI 侧栏的 `changerequests` Tab:
 *  - **会话绑定**:直接读 `useAiPanelStore.activeWorkspace` —— 该值本身按
 *    `conversationId → workspace` 隔离,切会话即换面板数据面(不新增第二套绑定);
 *  - **共享轮询**:数据面走 `change-requests` store 的 30s 共享计时器(页面隐藏跳过);
 *  - **状态如实**:无工作区 / 平台不支持 / 未连接凭据 / 拉取失败 / 空 / 有数据 六态分开渲染,
 *    任何一态都不得用"没有变更请求"糊过去;
 *  - **比 DSH 多一步**:当前分支尚无变更请求且凭据就绪时,一键创建(判据来自
 *    `canCreateChangeRequest`,端内不另写)。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, GitPullRequest, RefreshCw } from 'lucide-react'
import {
  canCreateChangeRequest,
  deriveChangeRequestCounts,
  findCurrentBranchChangeRequest,
  type ChangeRequestItem,
  type ChangeRequestProvider,
  type ChangeRequestState,
  type ChangeRequestChecksSummary,
} from '@ihui/types'
import { createGithubPullRequest } from '@ihui/api-client'

import { cn } from '@/lib/utils'
import { toast } from '@/components/common'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useEnvironmentInfoStore } from '@/stores/environment-info'
import { startChangeRequestPolling, useChangeRequestsStore } from '@/stores/change-requests'

const SUMMARY_TONE: Record<ChangeRequestChecksSummary, string> = {
  failing: 'text-destructive',
  pending: 'text-amber-600 dark:text-amber-500',
  successful: 'text-emerald-600 dark:text-emerald-500',
  none: 'text-muted-foreground',
}

const STATE_TONE: Record<ChangeRequestState, string> = {
  open: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  draft: 'bg-muted text-muted-foreground',
  merged: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  closed: 'bg-destructive/10 text-destructive',
}

/** 分支名 → 默认标题(feat/change-request-panel → change request panel) */
export function humanizeBranchName(branch: string): string {
  const tail = branch.split('/').filter(Boolean).at(-1) ?? branch
  return tail.replace(/[-_]+/g, ' ').trim() || branch
}

function formatTime(ts: number | null): string {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

export function ChangeRequestPanel() {
  const t = useTranslations('ai.pane.changeRequests')
  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)
  const openGithubConfig = useEnvironmentInfoStore((s) => s.openGithubConfig)
  const path = activeWorkspace?.path ?? ''
  const entry = useChangeRequestsStore((s) => (path ? s.byWorkspace[path] : undefined))
  const fetchList = useChangeRequestsStore((s) => s.fetch)
  const [creating, setCreating] = React.useState(false)

  React.useEffect(() => {
    if (!path) return
    void fetchList(path)
    return startChangeRequestPolling(path)
  }, [fetchList, path])

  const snapshot = entry?.snapshot ?? null
  const loading = entry?.loading ?? false

  const providerLabel: Record<ChangeRequestProvider, string> = {
    github: t('providerGithub'),
    gitee: t('providerGitee'),
    gitlab: t('providerGitlab'),
    other: t('providerOther'),
  }
  const stateLabel: Record<ChangeRequestState, string> = {
    open: t('stateOpen'),
    draft: t('stateDraft'),
    merged: t('stateMerged'),
    closed: t('stateClosed'),
  }

  const counts = deriveChangeRequestCounts(snapshot?.items)
  const current = findCurrentBranchChangeRequest(snapshot?.items)
  const canCreate = canCreateChangeRequest(snapshot)

  const handleCreate = React.useCallback(async () => {
    if (!snapshot?.repo || !snapshot.currentBranch || !snapshot.defaultBranch) return
    setCreating(true)
    try {
      const res = await createGithubPullRequest({
        owner: snapshot.repo.owner,
        repo: snapshot.repo.repo,
        title: humanizeBranchName(snapshot.currentBranch),
        head: snapshot.currentBranch,
        base: snapshot.defaultBranch,
      })
      if (res.success) {
        toast.success(t('createSuccess'))
        await fetchList(path, { force: true })
      } else {
        toast.error(res.error ?? t('createFailed'))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('createFailed'))
    } finally {
      setCreating(false)
    }
  }, [fetchList, path, snapshot, t])

  // ---- 空/不可用六态(顺序即判据顺序) ----
  let placeholder: React.ReactNode = null
  if (!path) {
    placeholder = (
      <p
        className="text-[11px] text-muted-foreground"
        data-testid="change-request-state-no-workspace"
      >
        {t('noWorkspace')}
      </p>
    )
  } else if (!snapshot && loading) {
    placeholder = (
      <p className="text-[11px] text-muted-foreground" data-testid="change-request-state-loading">
        {t('loading')}
      </p>
    )
  } else if (entry?.error || snapshot?.fetchFailed) {
    placeholder = (
      <div className="flex items-center gap-2" data-testid="change-request-state-fetch-failed">
        <span className="text-[11px] text-destructive">{t('fetchFailed')}</span>
        <button
          type="button"
          onClick={() => void fetchList(path, { force: true })}
          className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] hover:bg-accent"
        >
          {t('retry')}
        </button>
      </div>
    )
  } else if (snapshot && !snapshot.supported) {
    placeholder = (
      <p
        className="text-[11px] text-muted-foreground"
        data-testid="change-request-state-unsupported"
      >
        {snapshot.unsupportedReason === 'no-remote' ? t('noRemote') : t('unsupportedProvider')}
      </p>
    )
  } else if (snapshot && !snapshot.credentialsReady) {
    placeholder = (
      <div
        className="flex items-center gap-2"
        data-testid="change-request-state-credentials-missing"
      >
        <span className="text-[11px] text-muted-foreground">{t('credentialsMissing')}</span>
        <button
          type="button"
          onClick={openGithubConfig}
          className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] hover:bg-accent"
        >
          {t('connectGithub')}
        </button>
      </div>
    )
  } else if (snapshot && snapshot.items.length === 0) {
    placeholder = (
      <p className="text-[11px] text-muted-foreground" data-testid="change-request-state-empty">
        {t('empty')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2" data-testid="change-request-panel">
      <div className="flex items-center gap-1.5">
        <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-label font-medium">{t('title')}</span>
        {snapshot?.repo ? (
          <span className="truncate text-[11px] text-muted-foreground">
            {snapshot.repo.owner}/{snapshot.repo.repo}
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-1">
          {snapshot ? (
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {t('lastUpdated', { time: formatTime(entry?.lastFetchedAt ?? null) })}
            </span>
          ) : null}
          <button
            type="button"
            aria-label={t('refresh')}
            data-testid="change-request-refresh"
            disabled={loading || !path}
            onClick={() => void fetchList(path, { force: true })}
            className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} aria-hidden="true" />
          </button>
        </span>
      </div>

      {snapshot ? (
        <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
          <span className="rounded-sm bg-muted px-1.5 py-0.5">
            {providerLabel[snapshot.provider]}
          </span>
          {snapshot.currentBranch ? (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono">
              {snapshot.currentBranch}
            </span>
          ) : null}
          {snapshot.items.length > 0 ? (
            <span className="tabular-nums">
              {t('counts', { open: counts.open, draft: counts.draft, merged: counts.merged })}
            </span>
          ) : null}
        </div>
      ) : null}

      {placeholder}

      {snapshot && snapshot.items.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {snapshot.items.map((item) => (
            <ChangeRequestRow
              key={item.number}
              item={item}
              stateLabel={stateLabel[item.state]}
              currentLabel={t('currentBranch')}
            />
          ))}
        </ul>
      ) : null}

      {snapshot && canCreate ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="change-request-create"
            disabled={creating}
            onClick={() => void handleCreate()}
            className="rounded-sm bg-primary/10 px-2 py-0.5 text-[11px] text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
          >
            {creating ? t('creating') : t('create')}
          </button>
          {current ? null : (
            <span className="text-[10px] text-muted-foreground">{t('createHint')}</span>
          )}
        </div>
      ) : null}
    </div>
  )
}

function ChangeRequestRow({
  item,
  stateLabel,
  currentLabel,
}: {
  item: ChangeRequestItem
  stateLabel: string
  currentLabel: string
}) {
  const tPr = useTranslations('ai.pane.prChecks')
  const checks = item.checks
  const summaryTitle: Record<ChangeRequestChecksSummary, string> = {
    failing: tPr('summary.failing'),
    pending: tPr('summary.pending'),
    successful: tPr('summary.successful'),
    none: tPr('summary.none'),
  }
  return (
    <li
      className="flex flex-col gap-0.5 rounded-sm bg-muted/30 px-2 py-1"
      data-testid={`change-request-item-${item.number}`}
      data-current-branch={item.isCurrentBranch ? 'true' : 'false'}
    >
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          #{item.number}
        </span>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="truncate text-[11px] hover:underline"
          title={item.title}
        >
          {item.title}
        </a>
        <span className={cn('shrink-0 rounded-sm px-1 py-0.5 text-[10px]', STATE_TONE[item.state])}>
          {stateLabel}
        </span>
        {item.isCurrentBranch ? (
          <span
            className="shrink-0 rounded-sm bg-primary/10 px-1 py-0.5 text-[10px] text-primary"
            data-testid={`change-request-current-${item.number}`}
          >
            {currentLabel}
          </span>
        ) : null}
        <ExternalLink
          className="ml-auto h-3 w-3 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {item.headBranch ? (
          <span className="truncate font-mono">
            {item.headBranch}
            {item.baseBranch ? ` → ${item.baseBranch}` : ''}
          </span>
        ) : null}
        {checks ? (
          <span
            className={cn('ml-auto shrink-0 tabular-nums', SUMMARY_TONE[checks.summary])}
            data-check-summary={checks.summary}
            title={summaryTitle[checks.summary]}
          >
            {checks.total > 0
              ? tPr('countLabel', { passed: checks.passed, total: checks.total })
              : tPr('summary.none')}
          </span>
        ) : null}
      </div>
    </li>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
