'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { runCommand } from '@ihui/api-client'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { cn } from '@/lib/utils'
import { getFileIcon, getFileColor } from './file-icons'
import {
  GitBranch, RefreshCw, MoreHorizontal, Check, ChevronDown,
  Plus, Minus, ArrowUp, ArrowDown, GitCommit, Upload, Download, Loader2,
} from 'lucide-react'

/** unknown 错误归一化为字符串 */
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** 转义 commit message 中的双引号与反斜杠,防止 shell 注入 */
function escapeCommitMessage(msg: string): string {
  return msg.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
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
  const [stagedIds, setStagedIds] = React.useState<Set<string>>(new Set())
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

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (branchRef.current && !branchRef.current.contains(e.target as Node)) setBranchOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /** 同步已暂存文件列表(git diff --cached),用真实 git 状态驱动 stagedIds */
  const syncStagedFiles = React.useCallback(async () => {
    if (!workspacePath) return
    try {
      const result = await runCommand({
        command: 'git diff --name-only --cached',
        workspacePath,
      })
      if (result.success) {
        const staged = new Set(
          result.data.stdout
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((f) => `diff-${f}`),
        )
        setStagedIds(staged)
      }
    } catch {
      // 静默忽略,不影响主流程
    }
  }, [workspacePath])

  React.useEffect(() => {
    void syncStagedFiles()
  }, [syncStagedFiles])

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
      await Promise.all([fetchGitLog(), fetchGitBranches(), fetchDiffFiles(), syncStagedFiles()])
    } finally {
      setRefreshing(false)
    }
  }

  const toggleStage = async (file: typeof diffFiles[number]) => {
    if (!workspacePath) return
    const isStaged = stagedIds.has(file.id)
    const command = isStaged
      ? `git restore --staged "${file.filename}"`
      : `git add "${file.filename}"`
    try {
      const result = await runCommand({
        command,
        workspacePath,
        mode: 'workspace-write',
      })
      if (result.success) {
        setStagedIds((prev) => {
          const next = new Set(prev)
          if (isStaged) next.delete(file.id)
          else next.add(file.id)
          return next
        })
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
      const result = await runCommand({
        command: `git commit -m "${escapeCommitMessage(message)}"`,
        workspacePath,
        mode: 'workspace-write',
      })
      if (result.success) {
        toast.success(t('sourceControl.commitSuccess'))
        setCommitMessage('')
        await Promise.all([fetchDiffFiles(), fetchGitLog(), syncStagedFiles()])
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
      const result = await runCommand({
        command: 'git push',
        workspacePath,
        mode: 'workspace-write',
      })
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
      const result = await runCommand({
        command: 'git pull',
        workspacePath,
        mode: 'workspace-write',
      })
      if (result.success) {
        toast.success(t('sourceControl.pullSuccess'))
        await Promise.all([fetchGitLog(), fetchDiffFiles(), syncStagedFiles()])
      } else {
        toast.error(result.error)
      }
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setPulling(false)
    }
  }

  const handleBranchCheckout = async (target: string) => {
    setBranchOpen(false)
    if (!workspacePath || target === branch) return
    setSwitchingBranch(true)
    try {
      const result = await runCommand({
        command: `git checkout ${target}`,
        workspacePath,
        mode: 'workspace-write',
      })
      if (result.success) {
        setBranch(target)
        toast.success(t('sourceControl.branchSwitched', { branch: target }))
        await Promise.all([
          fetchGitBranches(),
          fetchGitLog(),
          fetchDiffFiles(),
          syncStagedFiles(),
        ])
      } else {
        toast.error(result.error)
      }
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setSwitchingBranch(false)
    }
  }

  const stagedFiles = diffFiles.filter((f) => stagedIds.has(f.id))
  const unstagedFiles = diffFiles.filter((f) => !stagedIds.has(f.id))

  const renderFile = (file: typeof diffFiles[number], staged: boolean) => {
    const Icon = getFileIcon(file.filename)
    return (
      <div
        key={file.id}
        className="group flex items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-muted/30"
      >
        <Icon className={cn('h-3.5 w-3.5 shrink-0', getFileColor(file.filename))} />
        <span className="truncate">{file.filename.split('/').pop()}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <span className="text-green-600 dark:text-green-400">+{file.additions}</span>
          <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
          <button
            onClick={() => toggleStage(file)}
            className="text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
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
            className="flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
          >
            <GitBranch className={cn('h-3.5 w-3.5 text-muted-foreground', switchingBranch && 'animate-spin')} />
            <span>{branch}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
          {/* 2026-07-28 修复(边界态空容器):原 `{branchOpen && (<div>{gitBranches.map(...)}</div>)}`
              只判断外层 branchOpen,没判断内层实际有无可显示项。
              当 gitBranches 长度为 0(空仓库 / fetch 失败 / 未加载)时,外层 div 仍渲染,
              但内部 map 输出 0 个按钮 → 用户看到一个无内容的浅色浮层。
              修复:外层 gate 同时检查 branchOpen && gitBranches.length > 0,与内层实际内容对齐。 */}
          {branchOpen && gitBranches.length > 0 && (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md">
              {gitBranches.map((b) => (
                <button
                  key={b}
                  onClick={() => handleBranchCheckout(b)}
                  disabled={switchingBranch}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1 text-xs transition-colors disabled:opacity-50',
                    b === branch ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  <GitBranch className="h-3 w-3" />
                  <span className="truncate">{b}</span>
                  {b === branch && <Check className="ml-auto h-3 w-3" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
            <ArrowUp className="h-3 w-3" />{ahead}
          </span>
          <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
            <ArrowDown className="h-3 w-3" />{behind}
          </span>
        </div>
        <div className="ml-auto flex gap-1">
          <button
            onClick={handlePull}
            disabled={pulling}
            className="rounded p-1 text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
            aria-label={t('sourceControl.pull')}
          >
            <Download className={cn('h-3.5 w-3.5', pulling && 'animate-spin')} />
          </button>
          <button
            onClick={handlePush}
            disabled={pushing}
            className="rounded p-1 text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
            aria-label={t('sourceControl.push')}
          >
            <Upload className={cn('h-3.5 w-3.5', pushing && 'animate-spin')} />
          </button>
          <button onClick={handleRefresh} className="rounded p-1 text-muted-foreground hover:bg-muted/50" aria-label={t('sourceControl.refresh')}>
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>
          <button className="rounded p-1 text-muted-foreground hover:bg-muted/50" aria-label={t('sourceControl.more')}><MoreHorizontal className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="px-2 py-1">
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder={t('sourceControl.commitPlaceholder')}
          rows={2}
          className="w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none"
        />
        <button
          onClick={handleCommit}
          disabled={committing || !commitMessage.trim()}
          aria-busy={committing}
          aria-label={t('sourceControl.commit')}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded-md bg-foreground py-1 text-xs text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          {committing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          <span>{committing ? t('sourceControl.committing') : t('sourceControl.commit')}</span>
        </button>
      </div>

      <div className="px-2 py-1.5">
        <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
          <span>{t('sourceControl.changeStats')}</span>
          <span className="ml-auto flex items-center gap-1">
            <span className="text-green-600 dark:text-green-400">+{totalAdd}</span>
            <span className="text-red-600 dark:text-red-400">-{totalDel}</span>
          </span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded bg-muted">
          <div className="h-full bg-green-500" style={{ width: `${addPct}%` }} />
          <div className="h-full bg-red-500" style={{ width: `${100 - addPct}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-1">
        {stagedFiles.length > 0 && (
          <div className="mb-2">
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
              {t('sourceControl.staged', { count: stagedFiles.length })}
            </div>
            {stagedFiles.map((f) => renderFile(f, true))}
          </div>
        )}
        <div className="mb-2">
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
            {t('sourceControl.changes', { count: unstagedFiles.length })}
          </div>
          {unstagedFiles.length > 0 ? (
            unstagedFiles.map((f) => renderFile(f, false))
          ) : (
            <div className="px-2 py-1 text-xs text-muted-foreground">{t('sourceControl.noChanges')}</div>
          )}
        </div>

        <div className="mb-2">
          <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground">
            <GitCommit className="h-3 w-3" />
            <span>{t('sourceControl.commitHistory')}</span>
          </div>
          {gitCommits.map((c) => (
            <div key={c.id} className="rounded px-2 py-1 text-xs hover:bg-muted/30">
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
