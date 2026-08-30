'use client'

import * as React from 'react'
import {
  ArrowDownToLine,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  CircleArrowOutUpRight,
  FileDiff,
  GitBranch,
  GitCommit,
  Loader2,
  Monitor,
  Plus,
  RefreshCw,
  Settings2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { useEnvironmentInfoStore } from '@/stores/environment-info'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useAgentProgressPaneStore } from '@/stores/agent-progress-pane'
import type { GitStatusSnapshot } from '@ihui/types'
import type { GithubStatus } from '@ihui/api-client'
import { EnvironmentCommitDialog } from './environment-commit-dialog'
import { EnvironmentInfoFullDialog } from './environment-info-full-dialog'
import { GithubConfigDialog } from './github-config-dialog'

/**
 * EnvironmentInfoPopover — AI 面板右上角"环境信息"按钮对应的 popover(2026-08-17 重写,严格对齐 Cursor 环境信息弹窗)。
 *
 * 行为契约:
 * - 位置:AI 面板 header 下方右侧,与 AgentTaskProgressPane 同区域(z 略高)。
 * - 互斥:打开本 popover 时自动关闭 AgentTaskProgressPane,避免两个浮层重叠。
 * - 打开时自动 fetch 一次数据;刷新按钮迁移到完整详情 Dialog(header 仅保留 "+" 打开完整详情)。
 * - 无 active workspace → 渲染"未选择工作区"占位,不调 API。
 *
 * UI 渲染规则(2026-08-30 对齐设计稿+用户反馈:扁平行列表,约 288px 宽,行高 32px,正文 13px/图标 16px,紧凑留白):
 * - header:左 "环境信息"(黑体)+ 右 "+"(Plus)按钮 → openFullView(完整详情 Dialog,非折叠)
 * - 变更行:FileDiff 图标 + "变更" + 右 +N 绿 / -M 红(优先行级 lineStats,降级文件数)/ ~M 灰
 * - 本地行:Monitor 图标,独立可展开(∨/∧),展开显示 workspace 路径 + remotes 列表
 * - 分支行:独立可展开(∨/∧),label 为分支名,展开显示 ahead/behind + 最近提交
 * - 提交或推送行:action 行(无内联输入),点击打开 EnvironmentCommitDialog
 * - PR 状态行:有 PR 显示可点链接;无 token 显示"连接 GitHub"配置入口;查询失败显示灰色降级文案;查询成功无 PR 显示中性提示
 * - 比较分支行:平台品牌图标 + "比较分支";GitHub 仓库 → GitHub compare 外链,否则点击跳转 IDE code-changes tab
 */

type EnvT = ReturnType<typeof useTranslations<'aiChat.envInfo'>>

export function EnvironmentInfoPopover() {
  const t = useTranslations('aiChat.envInfo')
  const open = useEnvironmentInfoStore((s) => s.open)
  const snapshot = useEnvironmentInfoStore((s) => s.snapshot)
  const loading = useEnvironmentInfoStore((s) => s.loading)
  const error = useEnvironmentInfoStore((s) => s.error)
  const fetchStatus = useEnvironmentInfoStore((s) => s.fetchStatus)
  const openFullView = useEnvironmentInfoStore((s) => s.openFullView)
  const openCommitDialog = useEnvironmentInfoStore((s) => s.openCommitDialog)
  const openGithubConfig = useEnvironmentInfoStore((s) => s.openGithubConfig)
  const githubStatus = useEnvironmentInfoStore((s) => s.githubStatus)
  const fetchGithubStatus = useEnvironmentInfoStore((s) => s.fetchGithubStatus)
  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)

  const workspacePath = activeWorkspace?.path ?? null
  const hasWorkspace = !!workspacePath

  // 打开时:关闭 agent progress pane(互斥)+ 拉一次数据 + 检测 GitHub 状态
  React.useEffect(() => {
    if (!open) return
    useAgentProgressPaneStore.getState().closePane()
    void fetchStatus(workspacePath)
    void fetchGithubStatus(workspacePath)
  }, [open, workspacePath, fetchStatus, fetchGithubStatus])

  if (!open) return null

  // inline 子元素方案: popover 是 messages-container 的绝对定位子元素,
  // 锚定到容器右上角(2026-08-30 用户指定,原 bottom-0 是错的),与 AgentTaskProgressPane 同模式,
  // 面板拖动/缩放时自动跟随,无需 portal。
  return (
    <div
      data-testid="env-info-popover"
      className={cn(
        'absolute top-0 right-0 z-sticky flex flex-col overflow-hidden',
        'rounded-lg border border-border bg-popover text-popover-foreground shadow-lg',
        'w-[min(288px,calc(100%-16px))]',
      )}
      role="complementary"
      aria-label={t('ariaLabel')}
    >
      <PopoverHeader onViewFull={openFullView} t={t} />
      <div className="flex flex-col text-xs">
        {!hasWorkspace && <NoWorkspaceHint t={t} />}
        {hasWorkspace && error && (
          <ErrorHint message={error} onRetry={() => fetchStatus(workspacePath)} t={t} />
        )}
        {hasWorkspace && snapshot && (
          <PopoverBody
            snapshot={snapshot}
            onCommit={openCommitDialog}
            onOpenGithubConfig={openGithubConfig}
            githubStatus={githubStatus}
            t={t}
          />
        )}
        {hasWorkspace && loading && !snapshot && (
          <div
            className="flex items-center gap-1.5 px-3 py-4 text-muted-foreground"
            data-testid="env-info-loading"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            <span>{t('loading')}</span>
          </div>
        )}
      </div>
      {/* 提交弹窗 + 完整详情 Dialog + GitHub 配置弹窗(订阅各自 store 开关,popover 打开时挂载) */}
      <EnvironmentCommitDialog />
      <EnvironmentInfoFullDialog />
      <GithubConfigDialog />
    </div>
  )
}

// ===== header =====

function PopoverHeader({ onViewFull, t }: { onViewFull: () => void; t: EnvT }) {
  return (
    <div
      className="flex h-9 shrink-0 items-center gap-1.5 bg-popover px-3"
      data-testid="env-info-header"
    >
      <span
        className="flex-1 truncate text-sm font-medium text-foreground"
        data-testid="env-info-title"
      >
        {t('title')}
      </span>
      <Tooltip content={t('viewFull')}>
        <button
          type="button"
          onClick={onViewFull}
          aria-label={t('viewFull')}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          data-testid="env-info-view-full"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </Tooltip>
    </div>
  )
}

// ===== 占位 / 错误 / loading =====

function NoWorkspaceHint({ t }: { t: EnvT }) {
  return (
    <div
      className="px-3 py-4 text-center text-muted-foreground"
      data-testid="env-info-no-workspace"
    >
      <p className="text-[13px]">{t('noWorkspace')}</p>
    </div>
  )
}

function ErrorHint({ message, onRetry, t }: { message: string; onRetry: () => void; t: EnvT }) {
  return (
    <div className="px-3 py-3" data-testid="env-info-error">
      <div className="text-[12px] font-medium text-destructive">{t('errorTitle')}</div>
      <div className="mt-1 break-all text-[12px] text-muted-foreground">{message}</div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex h-6 items-center gap-1 rounded border border-border px-2 text-[12px] text-foreground transition-colors hover:bg-accent"
        data-testid="env-info-error-retry"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        {t('retry')}
      </button>
    </div>
  )
}

// ===== 主体 =====

function PopoverBody({
  snapshot,
  onCommit,
  onOpenGithubConfig,
  githubStatus,
  t,
}: {
  snapshot: GitStatusSnapshot
  onCommit: () => void
  onOpenGithubConfig: () => void
  githubStatus: GithubStatus | null
  t: EnvT
}) {
  const [localExpanded, setLocalExpanded] = React.useState(false)
  const [branchExpanded, setBranchExpanded] = React.useState(false)

  if (!snapshot.isRepo) {
    return (
      <div className="px-3 py-4 text-center text-muted-foreground" data-testid="env-info-not-repo">
        <p className="text-[13px]">{t('notRepo')}</p>
      </div>
    )
  }

  const branch = snapshot.branch ?? t('detached')
  const ahead = snapshot.ahead
  const behind = snapshot.behind
  const added = snapshot.counts.added
  const deleted = snapshot.counts.deleted
  const otherChanges =
    snapshot.counts.modified +
    snapshot.counts.untracked +
    snapshot.counts.conflicted +
    snapshot.counts.renamed
  const totalChanges = added + deleted + otherChanges
  const canCommitPush = totalChanges > 0 || ahead > 0

  // 行级增删统计(对标 Cursor +N/-M);后端未返回或全 0 时降级为文件数
  const lineStats = snapshot.lineStats ?? null
  const hasLineStats = !!lineStats && (lineStats.additions > 0 || lineStats.deletions > 0)
  const platform = snapshot.platform ?? 'other'

  // 后端新增字段(localPath/remotes):可选访问防御,后端未返回时自然降级
  const localPath = snapshot.localPath ?? null
  const remotes = snapshot.remotes ?? []

  const handleCompare = () => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('ihui:open-ide-tab', { detail: { tab: 'code-changes' } }))
  }

  const compareUrl = buildCompareUrl(githubStatus)

  return (
    <>
      {/* 变更行 */}
      <EnvRow
        icon={<FileDiff className="h-4 w-4" aria-hidden />}
        label={t('changes')}
        right={
          totalChanges === 0 && !hasLineStats ? (
            <span
              className="text-muted-foreground tabular-nums"
              data-testid="env-info-changes-empty"
            >
              {t('noChanges')}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 tabular-nums" data-testid="env-info-changes">
              <span className="text-emerald-600 dark:text-emerald-400" data-testid="env-info-added">
                +{hasLineStats && lineStats ? lineStats.additions : added}
              </span>
              <span className="text-red-500 dark:text-red-400" data-testid="env-info-deleted">
                -{hasLineStats && lineStats ? lineStats.deletions : deleted}
              </span>
              {!hasLineStats && otherChanges > 0 && (
                <span className="text-muted-foreground" data-testid="env-info-other">
                  ~{otherChanges}
                </span>
              )}
            </span>
          )
        }
        testId="env-info-row-changes"
      />

      {/* 本地行(独立可展开) */}
      <ExpandableRow
        icon={<Monitor className="h-4 w-4" aria-hidden />}
        label={t('local')}
        expanded={localExpanded}
        onToggle={() => setLocalExpanded((v) => !v)}
        testId="env-info-row-local"
      />
      {localExpanded && (
        <div
          className="space-y-1 bg-muted/30 px-3 py-1 text-[12px] text-muted-foreground"
          data-testid="env-info-local-details"
        >
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-muted-foreground/70">{t('workspace')}:</span>
            <span className="truncate font-mono" data-testid="env-info-local-path">
              {localPath ?? '-'}
            </span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="shrink-0 text-muted-foreground/70">{t('remotes')}:</span>
            {remotes.length > 0 ? (
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {remotes.map((r, i) => (
                  <div
                    key={`${r.name}-${i}`}
                    className="truncate font-mono"
                    data-testid="env-info-remote"
                  >
                    <span className="text-foreground">{r.name}:</span>
                    <span className="text-muted-foreground">{r.url}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span data-testid="env-info-no-remotes">{t('noRemotes')}</span>
            )}
          </div>
        </div>
      )}

      {/* 分支行(独立可展开) */}
      <ExpandableRow
        icon={<GitBranch className="h-4 w-4" aria-hidden />}
        label={branch}
        labelTestId="env-info-branch"
        expanded={branchExpanded}
        onToggle={() => setBranchExpanded((v) => !v)}
        testId="env-info-row-branch"
      />
      {branchExpanded && (
        <div
          className="space-y-0.5 bg-muted/30 px-3 py-1 text-[12px] text-muted-foreground"
          data-testid="env-info-branch-details"
        >
          <div className="flex items-center gap-1.5 tabular-nums">
            <ArrowUp className="mr-0.5 inline h-3.5 w-3.5" aria-hidden />
            {ahead}
            <ArrowDownToLine className="mx-0.5 inline h-3.5 w-3.5" aria-hidden />
            {behind}
          </div>
          <div className="flex items-center gap-1.5" data-testid="env-info-last-commit">
            <span className="shrink-0 text-muted-foreground/70">{t('lastCommitTitle')}:</span>
            {snapshot.lastCommit ? (
              <>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground/70">
                  {snapshot.lastCommit.hash}
                </span>
                <span className="truncate">{truncate(snapshot.lastCommit.message, 40)}</span>
              </>
            ) : (
              <span className="truncate text-muted-foreground/70">{t('noCommit')}</span>
            )}
          </div>
        </div>
      )}

      {/* 提交或推送行(action:打开提交弹窗,不再内联展开) */}
      <EnvActionRow
        icon={<GitCommit className="h-4 w-4" aria-hidden />}
        label={t('commitPush')}
        onClick={onCommit}
        disabled={!canCommitPush}
        testId="env-info-row-commit-push"
      />

      {/* PR 状态行 */}
      <PullRequestRow
        snapshot={snapshot}
        githubStatus={githubStatus}
        prFetchFailed={snapshot.pullRequestFetchFailed === true}
        platform={platform}
        onConnectGithub={onOpenGithubConfig}
        t={t}
      />

      {/* 比较分支行(平台品牌图标 + "比较分支";GitHub 仓库 → 外链 compare,否则 → 跳转 IDE code-changes tab) */}
      {compareUrl ? (
        <EnvActionRow
          icon={<PlatformMark platform={platform} className="h-4 w-4" />}
          label={t('compareBranch')}
          href={compareUrl ?? undefined}
          testId="env-info-row-compare"
        />
      ) : (
        <EnvActionRow
          icon={<PlatformMark platform={platform} className="h-4 w-4" />}
          label={t('compareBranch')}
          onClick={handleCompare}
          testId="env-info-row-compare"
        />
      )}
    </>
  )
}

/** GitHub compare 外链 URL:仅在 GitHub 仓库且分支信息完整时可用。 */
function buildCompareUrl(status: GithubStatus | null): string | null {
  if (
    !status?.isGithubRepo ||
    !status.owner ||
    !status.repo ||
    !status.currentBranch ||
    !status.defaultBranch
  ) {
    return null
  }
  return `https://github.com/${status.owner}/${status.repo}/compare/${status.defaultBranch}...${status.currentBranch}`
}

// ===== 行组件 =====

/** 基础行:icon + label + right 三格,行高 h-8(32px)。 */
function EnvRow({
  icon,
  label,
  right,
  testId,
  className,
}: {
  icon: React.ReactNode
  label: string
  right?: React.ReactNode
  testId?: string
  className?: string
}) {
  return (
    <div className={cn('flex h-8 items-center gap-2 px-3', className)} data-testid={testId}>
      <span className="flex h-4 w-4 shrink-0 items-center text-muted-foreground">{icon}</span>
      <span className="flex-1 truncate text-[13px] text-foreground">{label}</span>
      {right && <span className="flex shrink-0 items-center text-[13px]">{right}</span>}
    </div>
  )
}

/** 可展开行:独立分组(本地/分支),点击展开/折叠,右侧 ∨/∧。 */
function ExpandableRow({
  icon,
  label,
  labelTestId,
  expanded,
  onToggle,
  testId,
}: {
  icon: React.ReactNode
  label: string
  labelTestId?: string
  expanded: boolean
  onToggle: () => void
  testId?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="flex h-8 w-full items-center gap-2 px-3 text-left transition-colors hover:bg-accent/40"
      data-testid={testId}
    >
      <span className="flex h-4 w-4 shrink-0 items-center text-muted-foreground">{icon}</span>
      <span
        className={cn('flex-1 truncate text-[13px]', labelTestId && 'font-medium')}
        data-testid={labelTestId}
      >
        {label}
      </span>
      {expanded ? (
        <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </button>
  )
}

/** action 行:可点击,支持 disabled(置灰 + cursor-not-allowed);传 href 时渲染外链 `<a>`。 */
function EnvActionRow({
  icon,
  label,
  right,
  onClick,
  disabled,
  testId,
  href,
}: {
  icon: React.ReactNode
  label: string
  right?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  testId?: string
  href?: string
}) {
  const cls = cn(
    'flex h-8 w-full items-center gap-2 px-3 transition-colors',
    href ? '' : 'text-left',
    disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-accent/40',
  )
  const inner = (
    <>
      <span className="flex h-4 w-4 shrink-0 items-center text-muted-foreground">{icon}</span>
      <span className="flex-1 truncate text-[13px] text-foreground">{label}</span>
      {right && <span className="flex shrink-0 items-center text-[13px]">{right}</span>}
    </>
  )
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls} data-testid={testId}>
        {inner}
      </a>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cls}
      data-testid={testId}
    >
      {inner}
    </button>
  )
}

// ===== 子组件 =====

function PullRequestRow({
  snapshot,
  githubStatus,
  prFetchFailed,
  platform,
  onConnectGithub,
  t,
}: {
  snapshot: GitStatusSnapshot
  githubStatus: GithubStatus | null
  prFetchFailed: boolean
  platform: GitPlatform
  onConnectGithub: () => void
  t: EnvT
}) {
  const pr = snapshot.pullRequest
  if (pr) {
    return (
      <a
        href={pr.url ?? '#'}
        target="_blank"
        rel="noreferrer"
        className="flex h-8 items-center gap-2 px-3 transition-colors hover:bg-accent/40"
        data-testid="env-info-row-pr"
      >
        <PlatformMark platform={platform} className={cn('h-4 w-4', prStateColor(pr.state))} />
        <span className="flex-1 truncate text-[13px] text-foreground">
          {pr.number ? `PR #${pr.number}` : t('pullRequest')}
          {pr.title ? `: ${truncate(pr.title, 26)}` : ''}
        </span>
        <CircleArrowOutUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </a>
    )
  }
  // 无远程仓库 → 灰色提示
  if (!snapshot.hasRemote) {
    return (
      <div
        className="flex h-8 items-center gap-2 px-3 text-muted-foreground"
        data-testid="env-info-row-pr"
      >
        <PlatformMark platform={platform} className="h-4 w-4" />
        <span className="flex-1 truncate text-[13px]">{t('prNoRemote')}</span>
      </div>
    )
  }
  // 有远程但未配置 token / 未检测 → 可点击的"连接 GitHub"配置入口
  if (githubStatus?.ghConfigured !== true) {
    return (
      <button
        type="button"
        onClick={onConnectGithub}
        className="flex h-8 w-full items-center gap-2 px-3 text-left transition-colors hover:bg-accent/40"
        data-testid="env-info-connect-github"
      >
        <PlatformMark platform={platform} className="h-4 w-4" />
        <span className="flex-1 truncate text-[13px] text-foreground">{t('prConnectHint')}</span>
        <Settings2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    )
  }
  // 已配 token 且查询失败 → 灰色降级文案
  if (prFetchFailed) {
    return (
      <div
        className="flex h-8 items-center gap-2 px-3 text-muted-foreground"
        data-testid="env-info-row-pr"
      >
        <PlatformMark platform={platform} className="h-4 w-4" />
        <span className="flex-1 truncate text-[13px]">{t('prUnavailable')}</span>
      </div>
    )
  }
  // 已配 token 且查询成功但当前分支无 PR → 中性提示
  return (
    <div
      className="flex h-8 items-center gap-2 px-3 text-muted-foreground"
      data-testid="env-info-row-pr-none"
    >
      <PlatformMark platform={platform} className="h-4 w-4" />
      <span className="flex-1 truncate text-[13px]">{t('prNone')}</span>
    </div>
  )
}

export type GitPlatform = 'github' | 'gitee' | 'gitlab' | 'other'

/** PR 行图标状态色(有 PR 时按状态着色,无 PR 时前景色) */
export function prStateColor(state: 'open' | 'merged' | 'closed' | 'draft' | null): string {
  if (state === 'open') return 'text-emerald-600 dark:text-emerald-400'
  if (state === 'merged') return 'text-violet-500 dark:text-violet-400'
  if (state === 'closed') return 'text-red-500 dark:text-red-400'
  return 'text-foreground'
}

/** Gitee 官方圆形 logo(simple-icons gitee,24x24;Gitee 无 lucide 图标,内联 SVG) */
export function GiteeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333H18.51a.36.36 0 0 1 .354.36v2.714a.36.36 0 0 1-.36.36h-4.11a.541.541 0 0 0-.54.541v1.215c0 .3.242.541.541.541h3.474a.36.36 0 0 1 .354.36v2.717a.36.36 0 0 1-.36.36h-4.986a.541.541 0 0 0-.541.54v5.51c0 .3-.242.542-.541.542H8.71a.541.541 0 0 1-.54-.542V11.16a.541.541 0 0 0-.542-.541H5.866a.541.541 0 0 1-.54-.54V5.692a.36.36 0 0 1 .36-.359h12.388z" />
    </svg>
  )
}

/** GitHub 官方 mark(Octicons mark-github 16x16,lucide 无品牌图标,内联 SVG) */
export function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

/** GitLab tanuki logo(lucide 1.x 移除品牌图标,采用 lucide 0.469 的 Gitlab path 内联,stroke 风格) */
export function GitlabMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m22 13.29-3.33-10a.42.42 0 0 0-.14-.18.38.38 0 0 0-.22-.11.39.39 0 0 0-.23.07.42.42 0 0 0-.14.18l-2.26 6.67H8.32L6.1 3.26a.42.42 0 0 0-.1-.18.38.38 0 0 0-.26-.08.39.39 0 0 0-.23.07.42.42 0 0 0-.14.18L2 13.29a.74.74 0 0 0 .27.83L12 21l9.69-6.88a.71.71 0 0 0 .31-.83Z" />
    </svg>
  )
}

/** 平台品牌图标:按 remote 推断的 platform 渲染对应 logo(other 用分支图标) */
export function PlatformMark({
  platform,
  className,
}: {
  platform: GitPlatform
  className?: string
}) {
  if (platform === 'gitee') return <GiteeMark className={className} />
  if (platform === 'gitlab') return <GitlabMark className={className} />
  if (platform === 'other') return <GitBranch className={className} aria-hidden />
  return <GithubMark className={className} />
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return `${s.slice(0, n - 1)}…`
}

export default EnvironmentInfoPopover
