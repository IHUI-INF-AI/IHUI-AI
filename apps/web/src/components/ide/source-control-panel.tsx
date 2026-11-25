// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'
import {
  commitGit,
  getGitStatus,
  pullWorkspaceGit,
  pushWorkspaceGit,
  stageGitPaths,
  switchWorkspaceGitBranch,
  unstageGitPaths,
} from '@ihui/api-client'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { useWorkspaceWatcher } from '@/hooks/use-workspace-watcher'
import { cn } from '@/lib/utils'
// 2026-09-15 治理:浮层定位/portal/关闭逻辑统一收敛到 PortalPanel
import { PortalPanel } from '@/components/feedback/portal-panel'
import { getFileIcon, getFileColor } from './file-icons'
import {
  GitBranch,
  RefreshCw,
  MoreHorizontal,
  Check,
  ChevronDown,
  Plus,
  Minus,
  ArrowUp,
  ArrowDown,
  GitCommit,
  Upload,
  Download,
  Loader2,
} from 'lucide-react'

/** unknown 错误归一化为字符串 */
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function SourceControlPanel() {
  const t = useTranslations('ide')
  const {
    activeView,
    diffFiles,
    gitCommits,
    gitBranches,
    gitCurrentBranch,
    workspacePath,
    fetchGitLog,
    fetchGitBranches,
    fetchDiffFiles,
  } = useIDEWorkspace()
  const [branch, setBranch] = React.useState(gitCurrentBranch)
  const [branchOpen, setBranchOpen] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)
  const [commitMessage, setCommitMessage] = React.useState('')
  const [committing, setCommitting] = React.useState(false)
  const [pushing, setPushing] = React.useState(false)
  const [pulling, setPulling] = React.useState(false)
  const [switchingBranch, setSwitchingBranch] = React.useState(false)
  const branchRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setBranch(gitCurrentBranch)
  }, [gitCurrentBranch])

  // 面板可见时订阅工作区变更:文件被外部保存/AI 改动后自动刷新差异与暂存态,
  // 不要求用户手点刷新。`.git` 事件已在 hook 内过滤,不会形成"刷新→事件→刷新"自激。
  const handleWorkspaceChange = React.useCallback(() => {
    void fetchDiffFiles()
  }, [fetchDiffFiles])
  useWorkspaceWatcher({
    workspacePath,
    enabled: activeView === 'source-control',
    onChange: handleWorkspaceChange,
  })

  if (activeView !== 'source-control') return null

  const totalAdd = diffFiles.reduce((s, f) => s + f.additions, 0)
  const totalDel = diffFiles.reduce((s, f) => s + f.deletions, 0)
  const total = Math.max(totalAdd + totalDel, 1)
  const addPct = (totalAdd / total) * 100
  const ahead = 2
  const behind = 0

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([fetchGitLog(), fetchGitBranches(), fetchDiffFiles()])
    } finally {
      setRefreshing(false)
    }
  }

  const toggleStage = async (file: (typeof diffFiles)[number], inStagedGroup: boolean) => {
    if (!workspacePath) return
    // 动作按「所在分组」判定,不看 file.staged:暂存后又改过的文件同现两组,
    // 在「更改」组里点 + 必须是补暂存剩余改动,而不是把已暂存那半撤掉。
    const isStaged = inStagedGroup
    try {
      const result = isStaged
        ? await unstageGitPaths({ workspacePath, paths: [file.filename] })
        : await stageGitPaths({ workspacePath, paths: [file.filename] })
      if (result.success) {
        // 暂存态不靠本地集合猜:staged 由服务端 diff-stat 同轮给出,刷新即真相
        await fetchDiffFiles()
      } else {
        toast.error(result.error)
      }
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  const handleCommit = async () => {
    const message = commitMessage.trim()
    if (!message) {
      toast.error(t('sourceControl.commitMessageRequired'))
      return
    }
    if (!workspacePath) return
    setCommitting(true)
    try {
      const result = await commitGit({ workspacePath, message })
      if (result.success) {
        toast.success(t('sourceControl.commitSuccess'))
        setCommitMessage('')
        await Promise.all([fetchDiffFiles(), fetchGitLog()])
      } else {
        toast.error(result.error)
      }
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setCommitting(false)
    }
  }

  const handlePush = async () => {
    if (!workspacePath) return
    setPushing(true)
    try {
      const result = await pushWorkspaceGit({ workspacePath })
      if (result.success) {
        toast.success(t('sourceControl.pushSuccess'))
        await Promise.all([fetchGitLog(), fetchGitBranches()])
      } else {
        toast.error(result.error)
      }
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setPushing(false)
    }
  }

  const handlePull = async () => {
    if (!workspacePath) return
    setPulling(true)
    try {
      const result = await pullWorkspaceGit({ workspacePath })
      if (result.success) {
        toast.success(t('sourceControl.pullSuccess'))
        await Promise.all([fetchGitLog(), fetchDiffFiles()])
      } else {
        toast.error(result.error)
      }
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setPulling(false)
    }
  }

  const doCheckout = async (target: string) => {
    if (!workspacePath) return
    setSwitchingBranch(true)
    try {
      const result = await switchWorkspaceGitBranch({ workspacePath, name: target })
      if (result.success) {
        setBranch(target)
        toast.success(t('sourceControl.branchSwitched', { branch: target }))
        await Promise.all([fetchGitBranches(), fetchGitLog(), fetchDiffFiles()])
      } else {
        toast.error(result.error)
      }
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setSwitchingBranch(false)
    }
  }

  // 2026-11-23:D178 的「保存改动并检出」曾用 git stash 兜底,与仓规「stash 全面禁止」
  // (多会话共享工作树会吞掉别人现场)冲突。现改为:切换前用结构化 git status 探测;
  // 有未提交改动(含未跟踪/冲突)⇒ 阻止并提示先提交或丢弃;探测失败也 fail-closed。
  const handleBranchCheckout = async (target: string) => {
    setBranchOpen(false)
    if (!workspacePath || target === branch) return
    try {
      const status = await getGitStatus({ workspacePath })
      if (!status.success) {
        toast.error(t('sourceControl.dirtySwitchDescription'))
        return
      }
      const dirty = Object.values(status.data.counts).some((n) => n > 0)
      if (dirty) {
        toast.error(t('sourceControl.dirtySwitchDescription'))
        return
      }
    } catch {
      toast.error(t('sourceControl.dirtySwitchDescription'))
      return
    }
    await doCheckout(target)
  }

  // 同一文件可同时出现在两组(暂存后又改过):staged/unstaged 两面都由服务端同轮给出。
  const stagedFiles = diffFiles.filter((f) => f.staged === true)
  const unstagedFiles = diffFiles.filter(
    (f) => f.unstaged === true || (f.unstaged === undefined && f.staged !== true),
  )

  const renderFile = (file: (typeof diffFiles)[number], staged: boolean) => {
    const Icon = getFileIcon(file.filename)
    return (
      <div
        key={`${staged ? 'staged' : 'unstaged'}-${file.id}`}
        className="group flex items-center gap-1.5 rounded-xl px-2 py-1 text-label hover:bg-muted/30"
      >
        <Icon className={cn('h-3.5 w-3.5 shrink-0', getFileColor(file.filename))} />
        <span className="truncate">{file.filename.split('/').pop()}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <span className="text-green-600 dark:text-green-400">+{file.additions}</span>
          <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
          <button
            onClick={() => toggleStage(file, staged)}
            className="text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
            aria-label={staged ? t('sourceControl.unstage') : t('sourceControl.stage')}
          >
            {staged ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </button>
        </span>
      </div>
    )
  }

  return (
    <div className="flex w-72 shrink-0 flex-col bg-muted/20">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div ref={branchRef} className="relative">
          <button
            onClick={() => setBranchOpen(!branchOpen)}
            disabled={switchingBranch}
            className="flex items-center gap-1 rounded-md px-1 py-0.5 text-label font-medium hover:bg-muted/50 disabled:opacity-50"
          >
            <GitBranch
              className={cn('h-3.5 w-3.5 text-muted-foreground', switchingBranch && 'animate-spin')}
            />
            <span>{branch}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
          {/* 2026-07-28 修复(边界态空容器):原 `{branchOpen && (<div>{gitBranches.map(...)}</div>)}`
              只判断外层 branchOpen,没判断内层实际有无可显示项。
              当 gitBranches 长度为 0(空仓库 / fetch 失败 / 未加载)时,外层 div 仍渲染,
              但内部 map 输出 0 个按钮 → 用户看到一个无内容的浅色浮层。
              修复:外层 gate 同时检查 branchOpen && gitBranches.length > 0,与内层实际内容对齐。 */}
          <PortalPanel
            open={branchOpen && gitBranches.length > 0}
            anchorRef={branchRef}
            onClose={() => setBranchOpen(false)}
            side="bottom"
            align="start"
            gap={4}
            className="min-w-[160px] rounded-xl border border-stroke-strong bg-popover p-1 shadow-elevation-md"
          >
            {gitBranches.map((b) => (
              <button
                key={b}
                onClick={() => handleBranchCheckout(b)}
                disabled={switchingBranch}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1 text-label transition-colors disabled:opacity-50',
                  b === branch
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <GitBranch className="h-3 w-3" />
                <span className="truncate">{b}</span>
                {b === branch && <Check className="ml-auto h-3 w-3" />}
              </button>
            ))}
          </PortalPanel>
        </div>
        <div className="flex items-center gap-1 text-label text-muted-foreground">
          <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
            <ArrowUp className="h-3 w-3" />
            {ahead}
          </span>
          <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
            <ArrowDown className="h-3 w-3" />
            {behind}
          </span>
        </div>
        <div className="ml-auto flex gap-1">
          <button
            onClick={handlePull}
            disabled={pulling}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
            aria-label={t('sourceControl.pull')}
          >
            <Download className={cn('h-3.5 w-3.5', pulling && 'animate-spin')} />
          </button>
          <button
            onClick={handlePush}
            disabled={pushing}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
            aria-label={t('sourceControl.push')}
          >
            <Upload className={cn('h-3.5 w-3.5', pushing && 'animate-spin')} />
          </button>
          <button
            onClick={handleRefresh}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted/50"
            aria-label={t('sourceControl.refresh')}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>
          <button
            className="rounded-md p-1 text-muted-foreground hover:bg-muted/50"
            aria-label={t('sourceControl.more')}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="px-2 py-1">
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder={t('sourceControl.commitPlaceholder')}
          rows={2}
          className="w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-label focus:outline-none"
        />
        <button
          onClick={handleCommit}
          disabled={committing || !commitMessage.trim()}
          aria-busy={committing}
          aria-label={t('sourceControl.commit')}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded-md bg-foreground py-1 text-label text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          {committing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          <span>{committing ? t('sourceControl.committing') : t('sourceControl.commit')}</span>
        </button>
      </div>

      <div className="px-2 py-1.5">
        <div className="mb-1 flex items-center gap-1 text-label text-muted-foreground">
          <span>{t('sourceControl.changeStats')}</span>
          <span className="ml-auto flex items-center gap-1">
            <span className="text-green-600 dark:text-green-400">+{totalAdd}</span>
            <span className="text-red-600 dark:text-red-400">-{totalDel}</span>
          </span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-xs bg-muted">
          <div className="h-full bg-green-500" style={{ width: `${addPct}%` }} />
          <div className="h-full bg-red-500" style={{ width: `${100 - addPct}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-1">
        {stagedFiles.length > 0 && (
          <div className="mb-2">
            <div className="px-2 py-1 text-label font-medium text-muted-foreground">
              {t('sourceControl.staged', { count: stagedFiles.length })}
            </div>
            {stagedFiles.map((f) => renderFile(f, true))}
          </div>
        )}
        <div className="mb-2">
          <div className="px-2 py-1 text-label font-medium text-muted-foreground">
            {t('sourceControl.changes', { count: unstagedFiles.length })}
          </div>
          {unstagedFiles.length > 0 ? (
            unstagedFiles.map((f) => renderFile(f, false))
          ) : (
            <div className="px-2 py-1 text-label text-muted-foreground">
              {t('sourceControl.noChanges')}
            </div>
          )}
        </div>

        <div className="mb-2">
          <div className="flex items-center gap-1 px-2 py-1 text-label font-medium text-muted-foreground">
            <GitCommit className="h-3 w-3" />
            <span>{t('sourceControl.commitHistory')}</span>
          </div>
          {gitCommits.map((c) => (
            <div key={c.id} className="rounded px-2 py-1 text-label hover:bg-muted/30">
              <div className="truncate">{c.message}</div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="truncate">{c.author}</span>
                <span>·</span>
                <span>{c.time}</span>
                <span className="ml-auto font-mono text-[10px]">{c.id.slice(0, 7)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
