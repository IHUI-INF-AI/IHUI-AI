'use client'

import * as React from 'react'
import { FileText, FolderTree, Box, Loader2, Download, Sparkles } from 'lucide-react'
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
 * - 结果展示:MarkdownViewer 渲染 + 下载按钮(导出 .md)
 *
 * 紧凑风格(AGENTS.md §4):Card 容器,无 rounded-full / 蓝色发光 / hr / divide-y。
 */

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
  const activeWorkspacePath = useAiPanelStore((s) => s.activeWorkspace?.path)

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
      toast.success('spec 文档已生成', {
        description: `扫描 ${r.data.stats.files} 文件 · ${r.data.stats.symbols} 符号 · ${r.data.durationMs}ms`,
      })
    } catch (e) {
      toast.error('spec 生成失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }, [activeWorkspacePath, scopeType, scopePath])

  const handleDownload = React.useCallback(() => {
    if (!result?.spec) return
    const blob = new Blob([result.spec], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spec-${Date.now()}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [result])

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

      {/* 统计信息(生成后) */}
      {result && (
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span>文件 {result.stats.files}</span>
          <span>符号 {result.stats.symbols}</span>
          <span>API {result.stats.endpoints}</span>
          <span>模型 {result.stats.schemas}</span>
          <span>耗时 {result.durationMs}ms</span>
          <button
            type="button"
            onClick={handleDownload}
            className="ml-auto flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted/60"
          >
            <Download className="h-3 w-3" />
            <span>下载 .md</span>
          </button>
        </div>
      )}

      {/* 结果展示(markdown 渲染) */}
      {result?.spec && (
        <div className="mt-3 max-h-[60vh] overflow-auto rounded-md border border-border bg-background p-3">
          <MarkdownViewer content={result.spec} />
        </div>
      )}
    </div>
  )
}
