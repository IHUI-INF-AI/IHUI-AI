'use client'

import * as React from 'react'
import { FileText, FolderTree, Box, Loader2, Download, Sparkles, History, GitCompare } from 'lucide-react'
import { toast } from 'sonner'
import type { SpecScopeType, SpecGenerateOutput } from '@ihui/types'
import { fetchApi } from '@/lib/api'
import { useAiPanelStore } from '@/stores/ai-panel'
import { cn } from '@/lib/utils'
import { MarkdownViewer } from '@/components/media/MarkdownViewer'

/**
 * Spec 模式专用面板(2026-07-22 立,对标 Trae IDE Spec 模式)。
 *
 * 从代码 AST 反向生成规格文档(markdown):
 * - scope 选择:单文件 / 目录 / 全工作区
 * - 生成按钮 → POST /api/spec/generate → ai-service tree-sitter AST 解析
 * - 历史版本下拉 → GET /api/spec/history + GET /api/spec/load
 * - 对比当前 → POST /api/spec/diff(unified diff 行级着色)
 * - 导出 → 下载 spec markdown 文件
 *
 * 紧凑风格(AGENTS.md §4):Card 容器,无 rounded-full / 蓝色发光 / hr / divide-y。
 */

/** 历史版本条目(与 spec-service.ts SpecHistoryEntry 对齐) */
interface SpecHistoryEntry {
  timestamp: string
  filePath: string
  summary: string
}

/** diff 结果(与 spec-service.ts SpecDiffResult 对齐) */
interface SpecDiffResult {
  oldSpec: string
  newSpec: string
  diff: string
  addedLines: number
  removedLines: number
  changedFiles: string[]
}

interface ScopeOption {
  type: SpecScopeType
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const SCOPE_OPTIONS: readonly ScopeOption[] = [
  { type: 'workspace', label: '工作区', icon: Box },
  { type: 'dir', label: '目录', icon: FolderTree },
  { type: 'file', label: '文件', icon: FileText },
]

export function SpecPanel({ className }: { className?: string }) {
  const [scopeType, setScopeType] = React.useState<SpecScopeType>('workspace')
  const [scopePath, setScopePath] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<SpecGenerateOutput | null>(null)
  const [history, setHistory] = React.useState<SpecHistoryEntry[]>([])
  const [selectedVersion, setSelectedVersion] = React.useState('latest')
  const [diffResult, setDiffResult] = React.useState<SpecDiffResult | null>(null)
  const [diffLoading, setDiffLoading] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<'spec' | 'diff'>('spec')
  const activeWorkspacePath = useAiPanelStore((s) => s.activeWorkspace?.path)

  // 构造 query string
  const buildQuery = React.useCallback((extra: Record<string, string> = {}) => {
    const params = new URLSearchParams({
      workspacePath: activeWorkspacePath || '',
      scopeType,
      ...extra,
    })
    if (scopePath.trim()) params.set('scopePath', scopePath.trim())
    return params.toString()
  }, [activeWorkspacePath, scopeType, scopePath])

  // 拉取历史版本列表
  const refreshHistory = React.useCallback(async () => {
    if (!activeWorkspacePath) return
    try {
      const r = await fetchApi<{ history: SpecHistoryEntry[] }>(
        `/api/spec/history?${buildQuery()}`,
      )
      if (r.success && r.data) {
        setHistory(r.data.history)
      }
    } catch {
      // 静默降级,不阻塞主流程
    }
  }, [activeWorkspacePath, buildQuery])

  const handleGenerate = React.useCallback(async () => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath) {
      toast.error('未绑定工作区', { description: '请先在 AI 面板绑定本地工作区目录' })
      return
    }
    if ((scopeType === 'file' || scopeType === 'dir') && !scopePath.trim()) {
      toast.error('请填写路径', { description: `选择 ${scopeType === 'file' ? '文件' : '目录'} 范围时需填写相对路径` })
      return
    }

    setLoading(true)
    setDiffResult(null)
    setViewMode('spec')
    try {
      const r = await fetchApi<SpecGenerateOutput>('/api/spec/generate', {
        method: 'POST',
        body: JSON.stringify({
          scope: { type: scopeType, path: scopePath.trim() || undefined },
          workspacePath,
        }),
      })
      if (!r.success || !r.data) {
        toast.error('spec 生成失败', { description: r.error || '未知错误' })
        return
      }
      setResult(r.data)
      setSelectedVersion('latest')
      toast.success('spec 文档已生成', {
        description: `扫描 ${r.data.stats.files} 文件 · ${r.data.stats.symbols} 符号 · ${r.data.durationMs}ms`,
      })
      // 生成后刷新历史列表
      void refreshHistory()
    } catch (e) {
      toast.error('spec 生成失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }, [activeWorkspacePath, scopeType, scopePath, refreshHistory])

  // 加载历史版本
  const handleLoadVersion = React.useCallback(async (version: string) => {
    if (!activeWorkspacePath) return
    setSelectedVersion(version)
    if (version === 'latest') {
      // 最新版本 = 当前 result(已生成)
      return
    }
    try {
      const r = await fetchApi<{ spec: string; filePath: string }>(
        `/api/spec/load?${buildQuery({ version })}`,
      )
      if (r.success && r.data && r.data.spec) {
        setResult((prev) => prev ? { ...prev, spec: r.data!.spec } : prev)
        setViewMode('spec')
        toast.success('已加载历史版本', { description: version })
      }
    } catch (e) {
      toast.error('加载失败', { description: e instanceof Error ? e.message : String(e) })
    }
  }, [activeWorkspacePath, buildQuery])

  // 对比当前(生成 diff)
  const handleDiff = React.useCallback(async () => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath) {
      toast.error('未绑定工作区')
      return
    }
    setDiffLoading(true)
    try {
      const r = await fetchApi<SpecDiffResult>('/api/spec/diff', {
        method: 'POST',
        body: JSON.stringify({
          scope: { type: scopeType, path: scopePath.trim() || undefined },
          workspacePath,
        }),
      })
      if (!r.success || !r.data) {
        toast.error('diff 生成失败', { description: r.error || '未知错误' })
        return
      }
      setDiffResult(r.data)
      setViewMode('diff')
      // diff 内部会重新生成 spec,更新 result
      if (r.data.newSpec) {
        setResult((prev) => prev ? { ...prev, spec: r.data!.newSpec } : prev)
      }
      toast.success('diff 已生成', {
        description: `+${r.data.addedLines} 行 / -${r.data.removedLines} 行`,
      })
    } catch (e) {
      toast.error('diff 生成失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setDiffLoading(false)
    }
  }, [activeWorkspacePath, scopeType, scopePath])

  // 导出 markdown
  const handleDownload = React.useCallback(() => {
    const spec = viewMode === 'diff' && diffResult ? diffResult.diff : result?.spec
    if (!spec) return
    const ext = viewMode === 'diff' ? 'diff' : 'md'
    const blob = new Blob([spec], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spec-${Date.now()}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [result, viewMode, diffResult])

  const showPathInput = scopeType === 'file' || scopeType === 'dir'

  return (
    <div className={cn('rounded-xl border border-border bg-card p-3', className)}>
      {/* 范围选择 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">范围</span>
        <div role="group" aria-label="spec 生成范围" className="flex items-center border border-border rounded-md overflow-hidden">
          {SCOPE_OPTIONS.map((opt, idx) => {
            const isActive = opt.type === scopeType
            const Icon = opt.icon
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => setScopeType(opt.type)}
                aria-pressed={isActive}
                title={opt.label}
                className={cn(
                  'flex h-7 items-center gap-1 px-2 text-xs font-medium transition-colors',
                  idx < SCOPE_OPTIONS.length - 1 && 'border-r border-border',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                <Icon className="h-3 w-3" />
                <span>{opt.label}</span>
              </button>
            )
          })}
        </div>
        {showPathInput && (
          <input
            type="text"
            value={scopePath}
            onChange={(e) => setScopePath(e.target.value)}
            placeholder={scopeType === 'file' ? '相对路径,如 apps/api/src/server.ts' : '相对路径,如 apps/api/src'}
            className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none"
          />
        )}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className={cn(
            'flex h-7 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            loading && 'cursor-not-allowed opacity-60',
          )}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          <span>{loading ? '生成中' : '生成'}</span>
        </button>
      </div>

      {/* 统计信息 + 操作按钮(生成后) */}
      {result && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>文件 {result.stats.files}</span>
          <span>符号 {result.stats.symbols}</span>
          <span>API {result.stats.endpoints}</span>
          <span>模型 {result.stats.schemas}</span>
          <span>耗时 {result.durationMs}ms</span>
          {/* 历史版本下拉 */}
          {history.length > 0 && (
            <div className="flex items-center gap-1">
              <History className="h-3 w-3" />
              <select
                value={selectedVersion}
                onChange={(e) => void handleLoadVersion(e.target.value)}
                className="h-6 rounded-md border border-border bg-background px-1 text-xs text-foreground focus:outline-none"
                title="历史版本"
              >
                <option value="latest">最新</option>
                {history.map((h) => (
                  <option key={h.timestamp} value={h.timestamp}>
                    {h.timestamp}
                  </option>
                ))}
              </select>
            </div>
          )}
          {/* 对比当前 */}
          <button
            type="button"
            onClick={handleDiff}
            disabled={diffLoading}
            className={cn(
              'flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted/60',
              diffLoading && 'cursor-not-allowed opacity-60',
            )}
            title="生成新 spec 并与上次持久化版本对比"
          >
            {diffLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <GitCompare className="h-3 w-3" />
            )}
            <span>对比当前</span>
          </button>
          {/* 视图切换(diff 存在时) */}
          {diffResult && (
            <div className="flex items-center border border-border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('spec')}
                className={cn(
                  'px-2 py-1 text-xs transition-colors',
                  viewMode === 'spec'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted/60',
                )}
              >
                spec
              </button>
              <button
                type="button"
                onClick={() => setViewMode('diff')}
                className={cn(
                  'border-l border-border px-2 py-1 text-xs transition-colors',
                  viewMode === 'diff'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted/60',
                )}
              >
                diff
              </button>
            </div>
          )}
          {/* 导出 */}
          <button
            type="button"
            onClick={handleDownload}
            className="ml-auto flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted/60"
          >
            <Download className="h-3 w-3" />
            <span>导出</span>
          </button>
        </div>
      )}

      {/* diff 展示(行级着色,紧凑) */}
      {viewMode === 'diff' && diffResult?.diff && (
        <div className="mt-3 max-h-[60vh] overflow-auto rounded-md border border-border bg-background p-2">
          <pre className="text-xs leading-5 font-mono">
            {diffResult.diff.split('\n').map((line, idx) => {
              const isAdd = line.startsWith('+') && !line.startsWith('+++')
              const isDel = line.startsWith('-') && !line.startsWith('---')
              const isHunk = line.startsWith('@@')
              const isHeader = line.startsWith('---') || line.startsWith('+++')
              return (
                <div
                  key={idx}
                  className={cn(
                    'px-2 whitespace-pre-wrap break-all',
                    isAdd && 'bg-green-500/10 text-green-700 dark:text-green-400',
                    isDel && 'bg-red-500/10 text-red-700 dark:text-red-400',
                    isHunk && 'text-cyan-600 dark:text-cyan-400',
                    isHeader && 'text-muted-foreground',
                    !isAdd && !isDel && !isHunk && !isHeader && 'text-muted-foreground',
                  )}
                >
                  {line || ' '}
                </div>
              )
            })}
          </pre>
        </div>
      )}

      {/* 结果展示(markdown 渲染) */}
      {viewMode === 'spec' && result?.spec && (
        <div className="mt-3 max-h-[60vh] overflow-auto rounded-md border border-border bg-background p-3">
          <MarkdownViewer content={result.spec} />
        </div>
      )}
    </div>
  )
}
