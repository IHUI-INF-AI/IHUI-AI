'use client'
import * as React from 'react'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { cn } from '@/lib/utils'
import { getFileIcon, getFileColor } from './file-icons'
import {
  GitBranch, RefreshCw, MoreHorizontal, Check, ChevronDown,
  Plus, Minus, ArrowUp, ArrowDown, GitCommit,
} from 'lucide-react'

const BRANCHES = ['main', 'develop', 'feature/ide-m6', 'fix/ui-tweak']

const COMMITS = [
  { id: 'a1b2c3', message: 'feat(ide): 添加搜索面板', author: 'Li Si', time: '2 小时前' },
  { id: 'd4e5f6', message: 'fix(diff): 修复状态色', author: 'Wang Wu', time: '5 小时前' },
  { id: '7g8h9i', message: 'refactor(store): 拆分状态', author: 'Zhang San', time: '昨天' },
  { id: 'j1k2l3', message: 'docs: 更新架构说明', author: 'Li Si', time: '2 天前' },
  { id: 'm4n5o6', message: 'chore: 升级依赖', author: 'Zhang San', time: '3 天前' },
]

export function SourceControlPanel() {
  const { activeView, diffFiles } = useIDEWorkspace()
  const [branch, setBranch] = React.useState('main')
  const [branchOpen, setBranchOpen] = React.useState(false)
  const [stagedIds, setStagedIds] = React.useState<Set<string>>(new Set(['diff-1']))
  const branchRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (branchRef.current && !branchRef.current.contains(e.target as Node)) setBranchOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (activeView !== 'source-control') return null

  const totalAdd = diffFiles.reduce((s, f) => s + f.additions, 0)
  const totalDel = diffFiles.reduce((s, f) => s + f.deletions, 0)
  const total = Math.max(totalAdd + totalDel, 1)
  const addPct = (totalAdd / total) * 100
  const ahead = 2
  const behind = 0

  const toggleStage = (id: string) => {
    setStagedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
            onClick={() => toggleStage(file.id)}
            className="text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
            aria-label={staged ? '取消暂存' : '暂存'}
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
            className="flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium hover:bg-muted/50"
          >
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{branch}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
          {branchOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md">
              {BRANCHES.map((b) => (
                <button
                  key={b}
                  onClick={() => { setBranch(b); setBranchOpen(false) }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1 text-xs transition-colors',
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
          <button className="rounded p-1 text-muted-foreground hover:bg-muted/50" aria-label="刷新"><RefreshCw className="h-3.5 w-3.5" /></button>
          <button className="rounded p-1 text-muted-foreground hover:bg-muted/50" aria-label="更多"><MoreHorizontal className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="px-2 py-1">
        <input
          placeholder="提交信息"
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none"
        />
        <button className="mt-1 flex w-full items-center justify-center gap-1 rounded-md bg-foreground py-1 text-xs text-background hover:bg-foreground/90">
          <Check className="h-3.5 w-3.5" />
          <span>提交</span>
        </button>
      </div>

      <div className="px-2 py-1.5">
        <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
          <span>变更统计</span>
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
              已暂存 ({stagedFiles.length})
            </div>
            {stagedFiles.map((f) => renderFile(f, true))}
          </div>
        )}
        <div className="mb-2">
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
            变更 ({unstagedFiles.length})
          </div>
          {unstagedFiles.length > 0 ? (
            unstagedFiles.map((f) => renderFile(f, false))
          ) : (
            <div className="px-2 py-1 text-xs text-muted-foreground">无变更</div>
          )}
        </div>

        <div className="mb-2">
          <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground">
            <GitCommit className="h-3 w-3" />
            <span>提交历史</span>
          </div>
          {COMMITS.map((c) => (
            <div key={c.id} className="rounded px-2 py-1 text-xs hover:bg-muted/30">
              <div className="truncate">{c.message}</div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="truncate">{c.author}</span>
                <span>·</span>
                <span>{c.time}</span>
                <span className="ml-auto font-mono text-[10px]">{c.id}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
