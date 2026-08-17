'use client'

import * as React from 'react'
import {
  ArrowDownToLine,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  CircleArrowOutUpRight,
  Folder,
  GitBranch,
  GitCommit,
  GitCompare,
  Loader2,
  Minus,
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
 * UI 渲染规则(对齐参考图,扁平行列表,约 280px 宽):
 * - header:左 "环境信息" 粗体 + 右 "+"(Plus)按钮 → openFullView(完整详情 Dialog,非折叠)
 * - 变更行:DiffGlyph + "变更" + 右 +N 绿 / -M 红 / ~M 灰
 * - 本地行:独立可展开(∨/∧),展开显示 workspace 路径 + remotes 列表
 * - 分支行:独立可展开(∨/∧),label 为分支名,展开显示 ahead/behind + 最近提交
 * - 提交或推送行:action 行(无内联输入),点击打开 EnvironmentCommitDialog
 * - PR 状态行:有 PR 显示可点链接;无 token 显示"连接 GitHub"配置入口;有 token 查询失败显示灰色降级文案
 * - 比较分支行:GitHub 仓库 → GitHub compare 外链(↗);否则点击跳转 IDE code-changes tab
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
  // 锚定到容器右下角(紧贴输入区上方,无间距),与 AgentTaskProgressPane 同模式,
  // 面板拖动/缩放时自动跟随,无需 portal。
  return (
    <div
      data-testid="env-info-popover"
      className={cn(
        'absolute bottom-0 right-0 z-sticky flex flex-col overflow-hidden',
        'rounded-lg border border-border bg-popover text-popover-foreground shadow-lg',
        'w-[min(280px,calc(100%-16px))]',
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
            className="flex items-center gap-1.5 px-3 py-4 text-muted-foreground/70"
            data-testid="env-info-loading"
          >
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
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
      className="flex h-9 shrink-0 items-center gap-1.5 bg-muted/40 px-3"
      data-testid="env-info-header"
    >
      <span className="flex-1 truncate text-[13px] font-medium text-foreground" data-testid="env-info-title">
        {t('title')}
      </span>
      <Tooltip content={t('viewFull')}>
        <button
          type="button"
          onClick={onViewFull}
          aria-label={t('viewFull')}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          data-testid="env-info-view-full"
        >
          <Plus className="h-3 w-3" aria-hidden />
        </button>
      </Tooltip>
    </div>
  )
}

// ===== 占位 / 错误 / loading =====

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
  const canCommitPush = totalChanges > 0 || ahead > 0

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

      {/* 本地行(独立可展开) */}
      <ExpandableRow
        icon={<Folder className="h-3.5 w-3.5" aria-hidden />}
        label={t('local')}
        expanded={localExpanded}
        onToggle={() => setLocalExpanded((v) => !v)}
        testId="env-info-row-local"
      />
      {localExpanded && (
        <div
          className="space-y-1 bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground/80"
          data-testid="env-info-local-details"
        >
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-muted-foreground/60">{t('workspace')}:</span>
            <span className="truncate font-mono" data-testid="env-info-local-path">
              {localPath ?? '-'}
            </span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="shrink-0 text-muted-foreground/60">{t('remotes')}:</span>
            {remotes.length > 0 ? (
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {remotes.map((r, i) => (
                  <div
                    key={`${r.name}-${i}`}
                    className="truncate font-mono"
                    data-testid="env-info-remote"
                  >
                    <span className="text-foreground/80">{r.name}:</span>
                    <span className="text-muted-foreground/70">{r.url}</span>
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
        icon={<GitBranch className="h-3.5 w-3.5" aria-hidden />}
        label={branch}
        labelTestId="env-info-branch"
        expanded={branchExpanded}
        onToggle={() => setBranchExpanded((v) => !v)}
        testId="env-info-row-branch"
      />
      {branchExpanded && (
        <div
          className="space-y-0.5 bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground/80"
          data-testid="env-info-branch-details"
        >
          <div className="flex items-center gap-1.5 tabular-nums">
            <ArrowUp className="mr-0.5 inline h-3 w-3" aria-hidden />
            {ahead}
            <ArrowDownToLine className="mx-0.5 inline h-3 w-3" aria-hidden />
            {behind}
          </div>
          <div className="flex items-center gap-1.5" data-testid="env-info-last-commit">
            <span className="shrink-0 text-muted-foreground/60">{t('lastCommitTitle')}:</span>
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

      {/* 提交或推送行(action:打开提交弹窗,不再内联展开) */}
      <EnvActionRow
        icon={<GitCommit className="h-3.5 w-3.5" aria-hidden />}
        label={t('commitPush')}
        onClick={onCommit}
        disabled={!canCommitPush}
        testId="env-info-row-commit-push"
      />

      {/* PR 状态行 */}
      <PullRequestRow snapshot={snapshot} githubStatus={githubStatus} onConnectGithub={onOpenGithubConfig} t={t} />

      {/* 比较分支行(GitHub 仓库 → 外链 compare;否则 → 跳转 IDE code-changes tab) */}
      {compareUrl ? (
        <EnvActionRow
          icon={<GitCompare className="h-3.5 w-3.5" aria-hidden />}
          label={t('compareOnGithub')}
          href={compareUrl ?? undefined}
          right={<CircleArrowOutUpRight className="h-3 w-3 text-muted-foreground/70" aria-hidden />}
          testId="env-info-row-compare"
        />
      ) : (
        <EnvActionRow
          icon={<GitCompare className="h-3.5 w-3.5" aria-hidden />}
          label={t('compareBranch')}
          onClick={handleCompare}
          right={<CircleArrowOutUpRight className="h-3 w-3 text-muted-foreground/70" aria-hidden />}
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

/** 基础行:icon + label + right 三格,行高 h-7(28px)。 */
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
    <div className={cn('flex h-7 items-center gap-2 px-3', className)} data-testid={testId}>
      <span className="flex h-3.5 w-3.5 shrink-0 items-center text-muted-foreground/80">{icon}</span>
      <span className="flex-1 truncate text-[12px] text-foreground/80">{label}</span>
      {right && <span className="flex shrink-0 items-center text-[12px]">{right}</span>}
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
      className="flex h-7 w-full items-center gap-2 px-3 text-left transition-colors hover:bg-accent/40"
      data-testid={testId}
    >
      <span className="flex h-3.5 w-3.5 shrink-0 items-center text-muted-foreground/80">{icon}</span>
      <span
        className={cn(
          'flex-1 truncate text-[12px]',
          labelTestId ? 'font-medium text-foreground' : 'text-foreground/80',
        )}
        data-testid={labelTestId}
      >
        {label}
      </span>
      {expanded ? (
        <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-hidden />
      ) : (
        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-hidden />
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
    'flex h-7 w-full items-center gap-2 px-3 transition-colors',
    href ? '' : 'text-left',
    disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-accent/40',
  )
  const inner = (
    <>
      <span className="flex h-3.5 w-3.5 shrink-0 items-center text-muted-foreground/80">{icon}</span>
      <span className="flex-1 truncate text-[12px] text-foreground/80">{label}</span>
      {right && <span className="flex shrink-0 items-center text-[12px]">{right}</span>}
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
    <button type="button" onClick={onClick} disabled={disabled} className={cls} data-testid={testId}>
      {inner}
    </button>
  )
}

// ===== 子组件 =====

function PullRequestRow({
  snapshot,
  githubStatus,
  onConnectGithub,
  t,
}: {
  snapshot: GitStatusSnapshot
  githubStatus: GithubStatus | null
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
        className="flex h-7 items-center gap-2 px-3 transition-colors hover:bg-accent/40"
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
  // 无远程仓库 → 灰色提示
  if (!snapshot.hasRemote) {
    return (
      <div className="flex h-7 items-center gap-2 px-3 text-muted-foreground/70" data-testid="env-info-row-pr">
        <PrGlyph state={null} />
        <span className="flex-1 truncate text-[12px]">{t('prNoRemote')}</span>
      </div>
    )
  }
  // 有远程但未配置 token / 未检测 → 可点击的"连接 GitHub"配置入口
  if (githubStatus?.ghConfigured !== true) {
    return (
      <button
        type="button"
        onClick={onConnectGithub}
        className="flex h-7 w-full items-center gap-2 px-3 text-left transition-colors hover:bg-accent/40"
        data-testid="env-info-connect-github"
      >
        <PrGlyph state={null} />
        <span className="flex-1 truncate text-[12px] text-foreground/80">{t('prConnectHint')}</span>
        <Settings2 className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-hidden />
      </button>
    )
  }
  // 已配 token 但 PR 查询失败 → 灰色降级文案
  return (
    <div className="flex h-7 items-center gap-2 px-3 text-muted-foreground/70" data-testid="env-info-row-pr">
      <PrGlyph state={null} />
      <span className="flex-1 truncate text-[12px]">{t('prUnavailable')}</span>
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
