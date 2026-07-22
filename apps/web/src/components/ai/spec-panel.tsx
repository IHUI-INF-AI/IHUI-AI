'use client'

import * as React from 'react'
import {
  FileText, FolderTree, Box, Loader2, Download, Sparkles, History, GitCompare,
  Code2, CheckCircle, ListTree, Brain, Eye, EyeOff, Play, Square,
  Workflow, AlertTriangle, GitBranch, Wand2, GitMerge, RotateCcw,
} from 'lucide-react'
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
 * 2026-07-22 深化(对标 Copilot Workspace / Aider):
 * - 代码生成标签页:POST /api/spec/apply → LLM 生成 patch + 应用按钮
 * - 评审标签页:submit / approve / reject 状态机
 * - 任务拆分标签页:POST /api/spec/split-tasks → LLM 拆分任务
 * - 智能分析标签页:POST /api/spec/enhance → LLM 风险点 + 改进建议
 * - watch 控件:启动/停止监听 + 活跃 watcher 列表
 *
 * 紧凑风格(AGENTS.md §4):Card 容器,无 rounded-full / 蓝色发光 / hr / divide-y。
 */

// ---------------------------------------------------------------------------
// 类型定义(与 spec-service.ts 对齐)
// ---------------------------------------------------------------------------

interface SpecHistoryEntry {
  timestamp: string
  filePath: string
  summary: string
}

interface SpecDiffResult {
  oldSpec: string
  newSpec: string
  diff: string
  addedLines: number
  removedLines: number
  changedFiles: string[]
}

interface SpecApplyResult {
  patch: string
  affectedFiles: string[]
  summary: string
  error?: string
}

interface SpecApplyConfirmResult {
  applied: string[]
  failed: Array<{ path: string; error: string }>
  backupDir: string
}

interface SpecReviewResult {
  spec: string
  filePath: string
  status: string
  error?: string
  currentStatus?: string
}

interface SpecSplitTasksResult {
  tasks: Array<{
    title: string
    description: string
    priority: string
    estimated_complexity: string
  }>
  fallback?: boolean
  error?: string
}

interface SpecEnhanceResult {
  spec: string
  enhancement: string
  filePath: string
  error?: string
  message?: string
}

interface SpecWatchStatusResult {
  watchers: Array<{
    watchId: string
    scope: { type: string; path?: string } | null
    workspacePath: string
    webhookUrl: string | null
    startedAt: string
    watchPath: string
  }>
}

// ---------------------------------------------------------------------------
// 2026-07-23 超越创新:全流程 / 影响分析 / 版本树 / 智能生成 类型
// ---------------------------------------------------------------------------

interface SpecPipelineStage {
  name: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  log: string
  startedAt?: string
  finishedAt?: string
}

interface SpecFullPipelineResult {
  pipelineId: string
  stages: SpecPipelineStage[]
  overallStatus: 'running' | 'success' | 'failed' | 'partial'
  backupDir: string
  commitSha: string
  error?: string
}

interface SpecPipelineStatusResult extends SpecFullPipelineResult {
  logs?: string[]
  ran?: boolean
}

interface SpecPipelineRollbackResult {
  rolled: number
  errors: string[]
  backupDir: string
  error?: string
}

interface SpecImpactAnalysisResult {
  affectedFiles: string[]
  affectedTests: string[]
  downstreamSpecs: string[]
  riskLevel: 'low' | 'medium' | 'high'
  llmAnalysis: {
    summary?: string
    riskReason?: string
    recommendations?: string[]
    error?: string
    message?: string
  }
  recommendations: string[]
}

interface SpecBranch {
  specId: string
  name: string
  baseVersion: string
  currentVersion: string
  createdAt: string
  status: 'active' | 'merged' | 'abandoned'
  filePath?: string
}

interface SpecBranchesResult {
  branches: SpecBranch[]
}

interface SpecBranchMergeResult {
  merged: boolean
  conflicts: string[]
  mergedContent: string
  branchName: string
  error?: string
}

interface SpecBranchDiffResult {
  diff: string
  addedLines: number
  removedLines: number
  branchName: string
  specId: string
  error?: string
}

interface SpecGenerateFromRequirementResult {
  spec: string
  sections: Array<{ title: string; level: number }>
  format: string
  error?: string
  message?: string
}

type TabMode = 'spec' | 'diff' | 'codegen' | 'review' | 'tasks' | 'enhance' | 'pipeline' | 'impact' | 'branches' | 'generate'

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

const TAB_OPTIONS: ReadonlyArray<{ mode: TabMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { mode: 'spec', label: 'spec', icon: FileText },
  { mode: 'diff', label: 'diff', icon: GitCompare },
  { mode: 'codegen', label: '代码生成', icon: Code2 },
  { mode: 'review', label: '评审', icon: CheckCircle },
  { mode: 'tasks', label: '任务拆分', icon: ListTree },
  { mode: 'enhance', label: '智能分析', icon: Brain },
  { mode: 'pipeline', label: '全流程', icon: Workflow },
  { mode: 'impact', label: '影响分析', icon: AlertTriangle },
  { mode: 'branches', label: '版本树', icon: GitBranch },
  { mode: 'generate', label: '智能生成', icon: Wand2 },
]

// ---------------------------------------------------------------------------
// 辅助:从 spec frontmatter 解析 status
// ---------------------------------------------------------------------------

function parseSpecStatus(spec: string): string {
  if (!spec.startsWith('---')) return 'draft'
  const parts = spec.split('---', 3)
  if (parts.length < 3) return 'draft'
  for (const line of parts[1]!.split('\n')) {
    const m = line.match(/^status:\s*(.+)/)
    if (m) return m[1]!.trim()
  }
  return 'draft'
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_review: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  approved: 'bg-green-500/10 text-green-700 dark:text-green-400',
  rejected: 'bg-red-500/10 text-red-700 dark:text-red-400',
}

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  pending_review: '待评审',
  approved: '已通过',
  rejected: '已拒绝',
}

const PRIORITY_BADGE: Record<string, string> = {
  P0: 'bg-red-500/10 text-red-700 dark:text-red-400',
  P1: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  P2: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  P3: 'bg-muted text-muted-foreground',
}

// 2026-07-23 超越创新:风险评分 + 流水线阶段 + 分支状态 徽章
const RISK_BADGE: Record<string, string> = {
  low: 'bg-green-500/10 text-green-700 dark:text-green-400',
  medium: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  high: 'bg-red-500/10 text-red-700 dark:text-red-400',
}

const RISK_LABEL: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
}

const STAGE_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  success: 'bg-green-500/10 text-green-700 dark:text-green-400',
  failed: 'bg-red-500/10 text-red-700 dark:text-red-400',
  skipped: 'bg-muted/60 text-muted-foreground',
}

const STAGE_STATUS_LABEL: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  success: '成功',
  failed: '失败',
  skipped: '跳过',
}

const STAGE_LABEL: Record<string, string> = {
  apply_spec: '生成 patch',
  apply_patch: '应用 patch',
  typecheck: '类型检查',
  test: '测试',
  commit: '提交',
}

const BRANCH_STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-500/10 text-green-700 dark:text-green-400',
  merged: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  abandoned: 'bg-muted text-muted-foreground',
}

const BRANCH_STATUS_LABEL: Record<string, string> = {
  active: '活跃',
  merged: '已合并',
  abandoned: '已废弃',
}

// ===========================================================================
// 主组件
// ===========================================================================

export function SpecPanel({ className }: { className?: string }) {
  const [scopeType, setScopeType] = React.useState<SpecScopeType>('workspace')
  const [scopePath, setScopePath] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<SpecGenerateOutput | null>(null)
  const [history, setHistory] = React.useState<SpecHistoryEntry[]>([])
  const [selectedVersion, setSelectedVersion] = React.useState('latest')
  const [diffResult, setDiffResult] = React.useState<SpecDiffResult | null>(null)
  const [diffLoading, setDiffLoading] = React.useState(false)
  const [tabMode, setTabMode] = React.useState<TabMode>('spec')

  // 代码生成标签页状态
  const [applyResult, setApplyResult] = React.useState<SpecApplyResult | null>(null)
  const [applyLoading, setApplyLoading] = React.useState(false)
  const [confirmLoading, setConfirmLoading] = React.useState(false)

  // 评审标签页状态
  const [reviewComment, setReviewComment] = React.useState('')
  const [reviewLoading, setReviewLoading] = React.useState(false)

  // 任务拆分标签页状态
  const [tasksResult, setTasksResult] = React.useState<SpecSplitTasksResult | null>(null)
  const [tasksLoading, setTasksLoading] = React.useState(false)

  // 智能分析标签页状态
  const [enhanceResult, setEnhanceResult] = React.useState<SpecEnhanceResult | null>(null)
  const [enhanceLoading, setEnhanceLoading] = React.useState(false)

  // watch 状态
  const [watchStatus, setWatchStatus] = React.useState<SpecWatchStatusResult | null>(null)
  const [watchLoading, setWatchLoading] = React.useState(false)

  // 2026-07-23 超越创新:全流程状态
  const [pipelineResult, setPipelineResult] = React.useState<SpecFullPipelineResult | null>(null)
  const [pipelineStatus, setPipelineStatus] = React.useState<SpecPipelineStatusResult | null>(null)
  const [pipelineLoading, setPipelineLoading] = React.useState(false)
  const [autoCommit, setAutoCommit] = React.useState(false)
  const [pipelineIdInput, setPipelineIdInput] = React.useState('')

  // 影响分析状态
  const [impactInput, setImpactInput] = React.useState('')
  const [impactResult, setImpactResult] = React.useState<SpecImpactAnalysisResult | null>(null)
  const [impactLoading, setImpactLoading] = React.useState(false)

  // 版本树状态
  const [branchesResult, setBranchesResult] = React.useState<SpecBranchesResult | null>(null)
  const [branchLoading, setBranchLoading] = React.useState(false)
  const [newBranchName, setNewBranchName] = React.useState('')
  const [branchBaseVersion, setBranchBaseVersion] = React.useState('latest')
  const [branchDiffResult, setBranchDiffResult] = React.useState<SpecBranchDiffResult | null>(null)
  const [branchDiffTarget, setBranchDiffTarget] = React.useState('')
  const [mergeConflicts, setMergeConflicts] = React.useState<string[] | null>(null)

  // 智能生成状态
  const [requirementInput, setRequirementInput] = React.useState('')
  const [requirementFormat, setRequirementFormat] = React.useState<'text' | 'markdown' | 'image_description'>('text')
  const [genResult, setGenResult] = React.useState<SpecGenerateFromRequirementResult | null>(null)
  const [genLoading, setGenLoading] = React.useState(false)

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

  const currentScope = React.useMemo(
    () => ({ type: scopeType, path: scopePath.trim() || undefined }),
    [scopeType, scopePath],
  )

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
      // 静默降级
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
    setTabMode('spec')
    try {
      const r = await fetchApi<SpecGenerateOutput>('/api/spec/generate', {
        method: 'POST',
        body: JSON.stringify({ scope: currentScope, workspacePath }),
      })
      if (!r.success || !r.data) {
        toast.error('spec 生成失败', { description: r.error || '未知错误' })
        return
      }
      setResult(r.data)
      setApplyResult(null)
      setTasksResult(null)
      setEnhanceResult(null)
      setSelectedVersion('latest')
      toast.success('spec 文档已生成', {
        description: `扫描 ${r.data.stats.files} 文件 · ${r.data.stats.symbols} 符号 · ${r.data.durationMs}ms`,
      })
      void refreshHistory()
    } catch (e) {
      toast.error('spec 生成失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }, [activeWorkspacePath, scopeType, scopePath, currentScope, refreshHistory])

  // 加载历史版本
  const handleLoadVersion = React.useCallback(async (version: string) => {
    if (!activeWorkspacePath) return
    setSelectedVersion(version)
    if (version === 'latest') return
    try {
      const r = await fetchApi<{ spec: string; filePath: string }>(
        `/api/spec/load?${buildQuery({ version })}`,
      )
      if (r.success && r.data && r.data.spec) {
        setResult((prev) => prev ? { ...prev, spec: r.data!.spec } : prev)
        setTabMode('spec')
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
        body: JSON.stringify({ scope: currentScope, workspacePath }),
      })
      if (!r.success || !r.data) {
        toast.error('diff 生成失败', { description: r.error || '未知错误' })
        return
      }
      setDiffResult(r.data)
      setTabMode('diff')
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
  }, [activeWorkspacePath, currentScope])

  // 代码生成:调 LLM 生成 patch
  const handleApply = React.useCallback(async () => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath || !result?.spec) {
      toast.error('请先生成 spec')
      return
    }
    setApplyLoading(true)
    try {
      const r = await fetchApi<SpecApplyResult>('/api/spec/apply', {
        method: 'POST',
        body: JSON.stringify({
          scope: currentScope,
          workspacePath,
          newSpec: result.spec,
        }),
      })
      if (!r.success || !r.data) {
        toast.error('代码生成失败', { description: r.error || '未知错误' })
        return
      }
      setApplyResult(r.data)
      toast.success('patch 已生成', { description: r.data.summary })
    } catch (e) {
      toast.error('代码生成失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setApplyLoading(false)
    }
  }, [activeWorkspacePath, result, currentScope])

  // 代码生成:确认应用 patch
  const handleApplyConfirm = React.useCallback(async () => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath || !applyResult?.patch) return
    setConfirmLoading(true)
    try {
      const r = await fetchApi<SpecApplyConfirmResult>('/api/spec/apply/confirm', {
        method: 'POST',
        body: JSON.stringify({
          workspacePath,
          patch: applyResult.patch,
          affectedFiles: applyResult.affectedFiles,
        }),
      })
      if (!r.success || !r.data) {
        toast.error('patch 应用失败', { description: r.error || '未知错误' })
        return
      }
      toast.success('patch 已应用', {
        description: `成功 ${r.data.applied.length} 个,失败 ${r.data.failed.length} 个,备份到 ${r.data.backupDir}`,
      })
    } catch (e) {
      toast.error('patch 应用失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setConfirmLoading(false)
    }
  }, [activeWorkspacePath, applyResult])

  // 评审:提交评审
  const handleSubmitReview = React.useCallback(async () => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath) return
    setReviewLoading(true)
    try {
      const r = await fetchApi<SpecReviewResult>('/api/spec/review/submit', {
        method: 'POST',
        body: JSON.stringify({ scope: currentScope, workspacePath }),
      })
      if (!r.success || !r.data) {
        toast.error('提交评审失败', { description: r.error || '未知错误' })
        return
      }
      if (r.data.spec) {
        setResult((prev) => prev ? { ...prev, spec: r.data!.spec } : prev)
      }
      toast.success('已提交评审', { description: `状态: ${STATUS_LABEL[r.data.status] || r.data.status}` })
    } catch (e) {
      toast.error('提交评审失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setReviewLoading(false)
    }
  }, [activeWorkspacePath, currentScope])

  // 评审:通过
  const handleApprove = React.useCallback(async () => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath) return
    setReviewLoading(true)
    try {
      const r = await fetchApi<SpecReviewResult>('/api/spec/review/approve', {
        method: 'POST',
        body: JSON.stringify({ scope: currentScope, workspacePath }),
      })
      if (!r.success || !r.data) {
        toast.error('审批失败', { description: r.error || '未知错误' })
        return
      }
      if (r.data.spec) {
        setResult((prev) => prev ? { ...prev, spec: r.data!.spec } : prev)
      }
      toast.success('已通过评审')
    } catch (e) {
      toast.error('审批失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setReviewLoading(false)
    }
  }, [activeWorkspacePath, currentScope])

  // 评审:拒绝
  const handleReject = React.useCallback(async () => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath) return
    setReviewLoading(true)
    try {
      const r = await fetchApi<SpecReviewResult>('/api/spec/review/reject', {
        method: 'POST',
        body: JSON.stringify({
          scope: currentScope,
          workspacePath,
          comment: reviewComment,
        }),
      })
      if (!r.success || !r.data) {
        toast.error('拒绝失败', { description: r.error || '未知错误' })
        return
      }
      if (r.data.spec) {
        setResult((prev) => prev ? { ...prev, spec: r.data!.spec } : prev)
      }
      toast.success('已拒绝')
    } catch (e) {
      toast.error('拒绝失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setReviewLoading(false)
    }
  }, [activeWorkspacePath, currentScope, reviewComment])

  // 任务拆分
  const handleSplitTasks = React.useCallback(async () => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath) return
    setTasksLoading(true)
    try {
      const r = await fetchApi<SpecSplitTasksResult>('/api/spec/split-tasks', {
        method: 'POST',
        body: JSON.stringify({ scope: currentScope, workspacePath }),
      })
      if (!r.success || !r.data) {
        toast.error('任务拆分失败', { description: r.error || '未知错误' })
        return
      }
      setTasksResult(r.data)
      toast.success(`已拆分 ${r.data.tasks.length} 个任务`, {
        description: r.data.fallback ? '降级模式:按章节机械拆分' : 'LLM 智能拆分',
      })
    } catch (e) {
      toast.error('任务拆分失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setTasksLoading(false)
    }
  }, [activeWorkspacePath, currentScope])

  // 任务拆分:导出到 PROJECT_PLAN
  const handleExportTasks = React.useCallback(() => {
    if (!tasksResult?.tasks.length) return
    const lines = tasksResult.tasks.map((t) => {
      const priority = t.priority.startsWith('P') ? t.priority : 'P2'
      return `- [ ] **${priority}** ${t.title}(${t.estimated_complexity}) — ${t.description}`
    })
    const text = `\n## Spec 拆分任务(${new Date().toISOString().slice(0, 10)})\n\n${lines.join('\n')}\n`
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spec-tasks-${Date.now()}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('任务已导出', { description: '请将内容追加到 PROJECT_PLAN.md' })
  }, [tasksResult])

  // 智能分析
  const handleEnhance = React.useCallback(async () => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath) return
    setEnhanceLoading(true)
    try {
      const r = await fetchApi<SpecEnhanceResult>('/api/spec/enhance', {
        method: 'POST',
        body: JSON.stringify({ scope: currentScope, workspacePath }),
      })
      if (!r.success || !r.data) {
        toast.error('智能分析失败', { description: r.error || '未知错误' })
        return
      }
      setEnhanceResult(r.data)
      if (r.data.spec) {
        setResult((prev) => prev ? { ...prev, spec: r.data!.spec } : prev)
      }
      toast.success('智能分析已生成')
    } catch (e) {
      toast.error('智能分析失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setEnhanceLoading(false)
    }
  }, [activeWorkspacePath, currentScope])

  // Watch:刷新状态
  const refreshWatchStatus = React.useCallback(async () => {
    try {
      const r = await fetchApi<SpecWatchStatusResult>('/api/spec/watch/status')
      if (r.success && r.data) {
        setWatchStatus(r.data)
      }
    } catch {
      // 静默
    }
  }, [])

  // Watch:启动监听
  const handleStartWatch = React.useCallback(async () => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath) {
      toast.error('未绑定工作区')
      return
    }
    setWatchLoading(true)
    try {
      const r = await fetchApi<{ watchId: string; status: string; watchPath: string }>('/api/spec/watch/start', {
        method: 'POST',
        body: JSON.stringify({ scope: currentScope, workspacePath }),
      })
      if (!r.success || !r.data) {
        toast.error('watch 启动失败', { description: r.error || '未知错误' })
        return
      }
      toast.success('监听已启动', { description: r.data.watchPath })
      void refreshWatchStatus()
    } catch (e) {
      toast.error('watch 启动失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setWatchLoading(false)
    }
  }, [activeWorkspacePath, currentScope, refreshWatchStatus])

  // Watch:停止监听
  const handleStopWatch = React.useCallback(async (watchId: string) => {
    setWatchLoading(true)
    try {
      const r = await fetchApi<{ watchId: string; status: string }>('/api/spec/watch/stop', {
        method: 'POST',
        body: JSON.stringify({ watchId }),
      })
      if (!r.success || !r.data) {
        toast.error('watch 停止失败', { description: r.error || '未知错误' })
        return
      }
      toast.success('监听已停止')
      void refreshWatchStatus()
    } catch (e) {
      toast.error('watch 停止失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setWatchLoading(false)
    }
  }, [refreshWatchStatus])

  // -------------------------------------------------------------------------
  // 2026-07-23 超越创新:全流程 / 影响分析 / 版本树 / 智能生成 handlers
  // -------------------------------------------------------------------------

  // 全流程:启动流水线
  const handleRunPipeline = React.useCallback(async () => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath || !result?.spec) {
      toast.error('请先生成 spec')
      return
    }
    setPipelineLoading(true)
    setPipelineResult(null)
    setPipelineStatus(null)
    try {
      const r = await fetchApi<SpecFullPipelineResult>('/api/spec/full-pipeline', {
        method: 'POST',
        body: JSON.stringify({
          scope: currentScope,
          workspacePath,
          newSpec: result.spec,
          autoCommit,
        }),
      })
      if (!r.success || !r.data) {
        toast.error('流水线执行失败', { description: r.error || '未知错误' })
        return
      }
      setPipelineResult(r.data)
      setPipelineIdInput(r.data.pipelineId)
      toast.success('流水线执行完成', {
        description: `状态: ${r.data.overallStatus} · commit: ${r.data.commitSha.slice(0, 8) || '(无)'}`,
      })
    } catch (e) {
      toast.error('流水线执行失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setPipelineLoading(false)
    }
  }, [activeWorkspacePath, result, currentScope, autoCommit])

  // 全流程:刷新状态
  const handleRefreshPipelineStatus = React.useCallback(async () => {
    const workspacePath = activeWorkspacePath
    const pid = pipelineIdInput || pipelineResult?.pipelineId
    if (!workspacePath || !pid) {
      toast.error('请先填写 pipeline ID 或启动流水线')
      return
    }
    try {
      const qs = new URLSearchParams({
        workspacePath,
        scopeType,
        pipelineId: pid,
      }).toString()
      if (scopePath.trim()) qs.concat(`&scopePath=${encodeURIComponent(scopePath.trim())}`)
      const r = await fetchApi<SpecPipelineStatusResult>(
        `/api/spec/pipeline-status?${qs}`,
      )
      if (!r.success || !r.data) {
        toast.error('状态查询失败', { description: r.error || '未知错误' })
        return
      }
      setPipelineStatus(r.data)
    } catch (e) {
      toast.error('状态查询失败', { description: e instanceof Error ? e.message : String(e) })
    }
  }, [activeWorkspacePath, pipelineIdInput, pipelineResult, scopeType, scopePath])

  // 全流程:回滚
  const handleRollback = React.useCallback(async () => {
    const workspacePath = activeWorkspacePath
    const backupDir = pipelineResult?.backupDir || pipelineStatus?.backupDir
    if (!workspacePath || !backupDir) {
      toast.error('无备份目录可回滚')
      return
    }
    setPipelineLoading(true)
    try {
      const r = await fetchApi<SpecPipelineRollbackResult>('/api/spec/pipeline-rollback', {
        method: 'POST',
        body: JSON.stringify({ workspacePath, backupDir }),
      })
      if (!r.success || !r.data) {
        toast.error('回滚失败', { description: r.error || '未知错误' })
        return
      }
      toast.success(`已回滚 ${r.data.rolled} 个文件`, {
        description: r.data.errors.length ? `${r.data.errors.length} 个错误` : '无错误',
      })
    } catch (e) {
      toast.error('回滚失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setPipelineLoading(false)
    }
  }, [activeWorkspacePath, pipelineResult, pipelineStatus])

  // 影响分析
  const handleAnalyzeImpact = React.useCallback(async () => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath) {
      toast.error('未绑定工作区')
      return
    }
    if (!impactInput.trim()) {
      toast.error('请填写拟修改内容')
      return
    }
    setImpactLoading(true)
    try {
      const r = await fetchApi<SpecImpactAnalysisResult>('/api/spec/impact-analysis', {
        method: 'POST',
        body: JSON.stringify({
          scope: currentScope,
          workspacePath,
          proposedChanges: impactInput,
        }),
      })
      if (!r.success || !r.data) {
        toast.error('影响分析失败', { description: r.error || '未知错误' })
        return
      }
      setImpactResult(r.data)
      toast.success('影响分析完成', {
        description: `风险: ${RISK_LABEL[r.data.riskLevel]} · 文件 ${r.data.affectedFiles.length}`,
      })
    } catch (e) {
      toast.error('影响分析失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setImpactLoading(false)
    }
  }, [activeWorkspacePath, impactInput, currentScope])

  // 版本树:刷新分支列表
  const refreshBranches = React.useCallback(async () => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath) return
    try {
      const r = await fetchApi<SpecBranchesResult>(
        `/api/spec/branches?workspacePath=${encodeURIComponent(workspacePath)}`,
      )
      if (r.success && r.data) {
        setBranchesResult(r.data)
      }
    } catch {
      // 静默
    }
  }, [activeWorkspacePath])

  // 版本树:创建分支
  const handleCreateBranch = React.useCallback(async () => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath) {
      toast.error('未绑定工作区')
      return
    }
    if (!newBranchName.trim()) {
      toast.error('请填写分支名')
      return
    }
    setBranchLoading(true)
    try {
      const r = await fetchApi<SpecBranch>('/api/spec/branch', {
        method: 'POST',
        body: JSON.stringify({
          scope: currentScope,
          workspacePath,
          branchName: newBranchName.trim(),
          baseVersion: branchBaseVersion,
        }),
      })
      if (!r.success || !r.data) {
        toast.error('分支创建失败', { description: r.error || '未知错误' })
        return
      }
      toast.success('分支已创建', { description: r.data.name })
      setNewBranchName('')
      void refreshBranches()
    } catch (e) {
      toast.error('分支创建失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBranchLoading(false)
    }
  }, [activeWorkspacePath, newBranchName, branchBaseVersion, currentScope, refreshBranches])

  // 版本树:合并分支
  const handleMergeBranch = React.useCallback(async (branchName: string) => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath) return
    setBranchLoading(true)
    setMergeConflicts(null)
    try {
      const r = await fetchApi<SpecBranchMergeResult>('/api/spec/branch/merge', {
        method: 'POST',
        body: JSON.stringify({ scope: currentScope, workspacePath, branchName }),
      })
      if (!r.success || !r.data) {
        toast.error('合并失败', { description: r.error || '未知错误' })
        return
      }
      if (r.data.conflicts.length > 0) {
        setMergeConflicts(r.data.conflicts)
        toast.warning('合并完成但有冲突', { description: `${r.data.conflicts.length} 处冲突已用 LLM 解决` })
      } else {
        toast.success('分支已合并', { description: branchName })
      }
      void refreshBranches()
    } catch (e) {
      toast.error('合并失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBranchLoading(false)
    }
  }, [activeWorkspacePath, currentScope, refreshBranches])

  // 版本树:废弃分支
  const handleAbandonBranch = React.useCallback(async (branchName: string) => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath) return
    setBranchLoading(true)
    try {
      const r = await fetchApi<{ abandoned: boolean; branchName: string }>('/api/spec/branch/abandon', {
        method: 'POST',
        body: JSON.stringify({ scope: currentScope, workspacePath, branchName }),
      })
      if (!r.success || !r.data) {
        toast.error('废弃失败', { description: r.error || '未知错误' })
        return
      }
      toast.success('分支已废弃', { description: branchName })
      void refreshBranches()
    } catch (e) {
      toast.error('废弃失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBranchLoading(false)
    }
  }, [activeWorkspacePath, currentScope, refreshBranches])

  // 版本树:查看分支 diff
  const handleDiffBranch = React.useCallback(async (branchName: string) => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath) return
    setBranchLoading(true)
    setBranchDiffTarget(branchName)
    try {
      const qs = new URLSearchParams({
        workspacePath,
        scopeType,
        branchName,
      }).toString()
      if (scopePath.trim()) qs.concat(`&scopePath=${encodeURIComponent(scopePath.trim())}`)
      const r = await fetchApi<SpecBranchDiffResult>(`/api/spec/branch/diff?${qs}`)
      if (!r.success || !r.data) {
        toast.error('diff 失败', { description: r.error || '未知错误' })
        return
      }
      setBranchDiffResult(r.data)
    } catch (e) {
      toast.error('diff 失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBranchLoading(false)
    }
  }, [activeWorkspacePath, scopeType, scopePath])

  // 智能生成:从需求生成 spec 草稿
  const handleGenerateFromRequirement = React.useCallback(async () => {
    const workspacePath = activeWorkspacePath
    if (!workspacePath) {
      toast.error('未绑定工作区')
      return
    }
    if (!requirementInput.trim()) {
      toast.error('请填写需求描述')
      return
    }
    setGenLoading(true)
    try {
      const r = await fetchApi<SpecGenerateFromRequirementResult>(
        '/api/spec/generate-from-requirement',
        {
          method: 'POST',
          body: JSON.stringify({
            workspacePath,
            requirement: requirementInput,
            format: requirementFormat,
          }),
        },
      )
      if (!r.success || !r.data) {
        toast.error('智能生成失败', { description: r.error || '未知错误' })
        return
      }
      setGenResult(r.data)
      toast.success('spec 草稿已生成', {
        description: `${r.data.sections.length} 个章节`,
      })
    } catch (e) {
      toast.error('智能生成失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setGenLoading(false)
    }
  }, [activeWorkspacePath, requirementInput, requirementFormat])

  // 导出 markdown
  const handleDownload = React.useCallback(() => {
    let content: string | undefined
    if (tabMode === 'diff' && diffResult) {
      content = diffResult.diff
    } else if (tabMode === 'codegen' && applyResult) {
      content = applyResult.patch
    } else {
      content = result?.spec
    }
    if (!content) return
    const ext = tabMode === 'diff' || tabMode === 'codegen' ? 'diff' : 'md'
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spec-${Date.now()}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [result, tabMode, diffResult, applyResult])

  const showPathInput = scopeType === 'file' || scopeType === 'dir'
  const currentStatus = result?.spec ? parseSpecStatus(result.spec) : 'draft'

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

      {/* 统计 + 标签页导航 + 操作按钮(生成后) */}
      {result && (
        <>
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

          {/* 标签页导航 */}
          <div className="mt-2 flex items-center gap-1 border-b border-border pb-1">
            {TAB_OPTIONS.map((tab) => {
              const isActive = tabMode === tab.mode
              const Icon = tab.icon
              return (
                <button
                  key={tab.mode}
                  type="button"
                  onClick={() => setTabMode(tab.mode)}
                  className={cn(
                    'flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* 标签页内容 */}
          <div className="mt-2">
            {/* spec 标签页 */}
            {tabMode === 'spec' && (
              <div className="max-h-[55vh] overflow-auto rounded-md border border-border bg-background p-3">
                <MarkdownViewer content={result.spec} />
              </div>
            )}

            {/* diff 标签页 */}
            {tabMode === 'diff' && (
              <div className="max-h-[55vh] overflow-auto rounded-md border border-border bg-background p-2">
                {diffResult?.diff ? (
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
                ) : (
                  <p className="text-xs text-muted-foreground p-2">点击「对比当前」生成 diff</p>
                )}
              </div>
            )}

            {/* 代码生成标签页 */}
            {tabMode === 'codegen' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={applyLoading}
                    className={cn(
                      'flex h-7 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors',
                      'bg-primary text-primary-foreground hover:bg-primary/90',
                      applyLoading && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {applyLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Code2 className="h-3 w-3" />}
                    <span>{applyLoading ? '生成中' : '生成 patch'}</span>
                  </button>
                  {applyResult?.patch && (
                    <button
                      type="button"
                      onClick={handleApplyConfirm}
                      disabled={confirmLoading}
                      className={cn(
                        'flex h-7 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs text-foreground hover:bg-muted/60',
                        confirmLoading && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      {confirmLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                      <span>应用 patch</span>
                    </button>
                  )}
                  {applyResult?.summary && (
                    <span className="text-xs text-muted-foreground">{applyResult.summary}</span>
                  )}
                </div>
                {applyResult?.patch && (
                  <div className="max-h-[50vh] overflow-auto rounded-md border border-border bg-background p-2">
                    <pre className="text-xs leading-5 font-mono">
                      {applyResult.patch.split('\n').map((line, idx) => {
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
                {!applyResult?.patch && (
                  <p className="text-xs text-muted-foreground p-2">点击「生成 patch」对比新旧 spec 生成代码补丁</p>
                )}
              </div>
            )}

            {/* 评审标签页 */}
            {tabMode === 'review' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">当前状态:</span>
                  <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', STATUS_BADGE[currentStatus] || STATUS_BADGE.draft)}>
                    {STATUS_LABEL[currentStatus] || currentStatus}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(currentStatus === 'draft' || currentStatus === 'rejected') && (
                    <button
                      type="button"
                      onClick={handleSubmitReview}
                      disabled={reviewLoading}
                      className="flex h-7 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    >
                      {reviewLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                      <span>提交评审</span>
                    </button>
                  )}
                  {currentStatus === 'pending_review' && (
                    <>
                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={reviewLoading}
                        className="flex h-7 items-center gap-1 rounded-md bg-green-600 px-3 text-xs font-medium text-white hover:bg-green-600/90 disabled:opacity-60"
                      >
                        {reviewLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                        <span>通过</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={reviewLoading}
                        className="flex h-7 items-center gap-1 rounded-md bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-600/90 disabled:opacity-60"
                      >
                        <Square className="h-3 w-3" />
                        <span>拒绝</span>
                      </button>
                      <input
                        type="text"
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="拒绝原因(可选)"
                        className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none"
                      />
                    </>
                  )}
                  {(currentStatus === 'approved' || currentStatus === 'rejected') && (
                    <p className="text-xs text-muted-foreground">
                      评审已结束,如需重新评审请先修改 spec 并重新生成
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 任务拆分标签页 */}
            {tabMode === 'tasks' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSplitTasks}
                    disabled={tasksLoading}
                    className={cn(
                      'flex h-7 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors',
                      'bg-primary text-primary-foreground hover:bg-primary/90',
                      tasksLoading && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {tasksLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ListTree className="h-3 w-3" />}
                    <span>{tasksLoading ? '拆分中' : '拆分任务'}</span>
                  </button>
                  {tasksResult?.tasks.length ? (
                    <button
                      type="button"
                      onClick={handleExportTasks}
                      className="flex h-7 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs text-foreground hover:bg-muted/60"
                    >
                      <Download className="h-3 w-3" />
                      <span>导出到 PROJECT_PLAN</span>
                    </button>
                  ) : null}
                  {tasksResult?.fallback && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">降级模式</span>
                  )}
                </div>
                {tasksResult?.tasks.length ? (
                  <div className="max-h-[50vh] space-y-1 overflow-auto rounded-md border border-border bg-background p-2">
                    {tasksResult.tasks.map((task, idx) => (
                      <div key={idx} className="rounded-md bg-muted/40 p-2">
                        <div className="flex items-center gap-2">
                          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.P2)}>
                            {task.priority}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {task.estimated_complexity}
                          </span>
                          <span className="text-xs font-medium text-foreground">{task.title}</span>
                        </div>
                        {task.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground p-2">点击「拆分任务」从 spec 章节自动生成任务列表</p>
                )}
              </div>
            )}

            {/* 智能分析标签页 */}
            {tabMode === 'enhance' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleEnhance}
                    disabled={enhanceLoading}
                    className={cn(
                      'flex h-7 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors',
                      'bg-primary text-primary-foreground hover:bg-primary/90',
                      enhanceLoading && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {enhanceLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                    <span>{enhanceLoading ? '分析中' : '生成智能分析'}</span>
                  </button>
                </div>
                {enhanceResult?.enhancement ? (
                  <div className="max-h-[50vh] overflow-auto rounded-md border border-border bg-background p-3">
                    <MarkdownViewer content={enhanceResult.enhancement} />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground p-2">
                    点击「生成智能分析」由 LLM 分析 spec,生成功能意图说明 + 潜在风险点 + 改进建议
                  </p>
                )}
              </div>
            )}

            {/* 全流程标签页(2026-07-23 超越创新) */}
            {tabMode === 'pipeline' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRunPipeline}
                    disabled={pipelineLoading || !result?.spec}
                    className={cn(
                      'flex h-7 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors',
                      'bg-primary text-primary-foreground hover:bg-primary/90',
                      (pipelineLoading || !result?.spec) && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {pipelineLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Workflow className="h-3 w-3" />}
                    <span>{pipelineLoading ? '执行中' : '启动全流程'}</span>
                  </button>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={autoCommit}
                      onChange={(e) => setAutoCommit(e.target.checked)}
                      className="h-3 w-3"
                    />
                    <span>自动 commit</span>
                  </label>
                  <input
                    type="text"
                    value={pipelineIdInput}
                    onChange={(e) => setPipelineIdInput(e.target.value)}
                    placeholder="pipeline ID(查询用)"
                    className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleRefreshPipelineStatus}
                    className="flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-foreground hover:bg-muted/60"
                  >
                    <History className="h-3 w-3" />
                    <span>刷新状态</span>
                  </button>
                  {(pipelineResult?.backupDir || pipelineStatus?.backupDir) && (
                    <button
                      type="button"
                      onClick={handleRollback}
                      disabled={pipelineLoading}
                      className="flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-red-600 hover:bg-red-500/10 disabled:opacity-60"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>回滚</span>
                    </button>
                  )}
                </div>
                {/* 5 阶段进度条 */}
                {(() => {
                  const stages = pipelineStatus?.stages || pipelineResult?.stages || []
                  if (!stages.length) {
                    return (
                      <p className="text-xs text-muted-foreground p-2">
                        点击「启动全流程」执行 apply_spec → apply_patch → typecheck → test → commit,
                        失败时自动备份可回滚
                      </p>
                    )
                  }
                  return (
                    <div className="space-y-1 rounded-md border border-border bg-background p-2">
                      {stages.map((stage, idx) => (
                        <div key={idx} className="rounded-md bg-muted/40 p-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground">
                              {idx + 1}. {STAGE_LABEL[stage.name] || stage.name}
                            </span>
                            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', STAGE_STATUS_BADGE[stage.status] || STAGE_STATUS_BADGE.pending)}>
                              {STAGE_STATUS_LABEL[stage.status] || stage.status}
                            </span>
                            {stage.finishedAt && stage.startedAt && (
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(stage.finishedAt).getTime() - new Date(stage.startedAt).getTime()}ms
                              </span>
                            )}
                          </div>
                          {stage.log && (
                            <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">
                              {stage.log.slice(0, 800)}
                            </pre>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-muted-foreground">整体:</span>
                        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', STAGE_STATUS_BADGE[(pipelineStatus?.overallStatus || pipelineResult?.overallStatus || 'pending') as string] || STAGE_STATUS_BADGE.pending)}>
                          {STAGE_STATUS_LABEL[(pipelineStatus?.overallStatus || pipelineResult?.overallStatus || 'pending') as string] || (pipelineStatus?.overallStatus || pipelineResult?.overallStatus)}
                        </span>
                        {pipelineResult?.commitSha && (
                          <span className="text-[10px] text-muted-foreground">commit: {pipelineResult.commitSha.slice(0, 8)}</span>
                        )}
                      </div>
                      {/* 日志区域 */}
                      {(pipelineStatus?.logs?.length || 0) > 0 && (
                        <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted/30 p-2 text-[10px] text-muted-foreground">
                          {pipelineStatus?.logs?.join('\n')}
                        </pre>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* 影响分析标签页(2026-07-23 超越创新) */}
            {tabMode === 'impact' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAnalyzeImpact}
                    disabled={impactLoading}
                    className={cn(
                      'flex h-7 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors',
                      'bg-primary text-primary-foreground hover:bg-primary/90',
                      impactLoading && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {impactLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
                    <span>{impactLoading ? '分析中' : '分析影响'}</span>
                  </button>
                </div>
                <textarea
                  value={impactInput}
                  onChange={(e) => setImpactInput(e.target.value)}
                  placeholder="拟修改内容(支持 markdown,LLM 将分析影响范围 + 风险)"
                  rows={5}
                  className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none"
                />
                {impactResult && (
                  <div className="max-h-[45vh] space-y-2 overflow-auto rounded-md border border-border bg-background p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">风险评分:</span>
                      <span className={cn('rounded px-2 py-0.5 text-xs font-bold', RISK_BADGE[impactResult.riskLevel])}>
                        {RISK_LABEL[impactResult.riskLevel] || impactResult.riskLevel}
                      </span>
                      {impactResult.llmAnalysis?.summary && (
                        <span className="text-xs text-muted-foreground">{impactResult.llmAnalysis.summary}</span>
                      )}
                    </div>
                    {impactResult.llmAnalysis?.riskReason && (
                      <p className="text-xs text-muted-foreground">{impactResult.llmAnalysis.riskReason}</p>
                    )}
                    <div>
                      <p className="text-xs font-medium text-foreground">受影响文件 ({impactResult.affectedFiles.length})</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {impactResult.affectedFiles.slice(0, 20).map((f, i) => (
                          <span key={i} className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {f}
                          </span>
                        ))}
                        {impactResult.affectedFiles.length > 20 && (
                          <span className="text-[10px] text-muted-foreground">+{impactResult.affectedFiles.length - 20}</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">受影响测试 ({impactResult.affectedTests.length})</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {impactResult.affectedTests.slice(0, 10).map((f, i) => (
                          <span key={i} className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {f}
                          </span>
                        ))}
                        {impactResult.affectedTests.length > 10 && (
                          <span className="text-[10px] text-muted-foreground">+{impactResult.affectedTests.length - 10}</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">下游 spec ({impactResult.downstreamSpecs.length})</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {impactResult.downstreamSpecs.map((f, i) => (
                          <span key={i} className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                    {impactResult.recommendations.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-foreground">建议措施</p>
                        <ul className="mt-1 space-y-0.5">
                          {impactResult.recommendations.map((r, i) => (
                            <li key={i} className="text-xs text-muted-foreground">
                              <span className="text-foreground">•</span> {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {impactResult.llmAnalysis?.error && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        LLM 不可用({impactResult.llmAnalysis.error}),仅展示静态扫描结果
                      </p>
                    )}
                  </div>
                )}
                {!impactResult && !impactLoading && (
                  <p className="text-xs text-muted-foreground p-2">
                    填写拟修改内容后点击「分析影响」,LLM + 静态扫描预测影响范围 + 风险评分
                  </p>
                )}
              </div>
            )}

            {/* 版本树标签页(2026-07-23 超越创新) */}
            {tabMode === 'branches' && (
              <div className="space-y-2">
                {/* 创建分支表单 */}
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background p-2">
                  <GitBranch className="h-3 w-3 text-muted-foreground" />
                  <input
                    type="text"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="分支名(如 feature/auth)"
                    className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none"
                  />
                  <select
                    value={branchBaseVersion}
                    onChange={(e) => setBranchBaseVersion(e.target.value)}
                    className="h-7 rounded-md border border-border bg-background px-1 text-xs text-foreground focus:outline-none"
                    title="基线版本"
                  >
                    <option value="latest">最新</option>
                    {history.map((h) => (
                      <option key={h.timestamp} value={h.timestamp}>
                        {h.timestamp}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleCreateBranch}
                    disabled={branchLoading || !newBranchName.trim()}
                    className={cn(
                      'flex h-7 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors',
                      'bg-primary text-primary-foreground hover:bg-primary/90',
                      (branchLoading || !newBranchName.trim()) && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {branchLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitBranch className="h-3 w-3" />}
                    <span>创建分支</span>
                  </button>
                  <button
                    type="button"
                    onClick={refreshBranches}
                    className="flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-foreground hover:bg-muted/60"
                  >
                    <History className="h-3 w-3" />
                    <span>刷新</span>
                  </button>
                </div>

                {/* SVG 分支图 */}
                {branchesResult?.branches.length ? (
                  <div className="rounded-md border border-border bg-background p-2">
                    <svg width="100%" height="80" viewBox="0 0 600 80" className="block">
                      {/* main 线 */}
                      <line x1="20" y1="40" x2="580" y2="40" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
                      <circle cx="20" cy="40" r="4" className="fill-foreground" />
                      <text x="20" y="60" textAnchor="middle" className="fill-muted-foreground text-[10px]">main</text>
                      {branchesResult.branches.map((b, idx) => {
                        const x = 80 + idx * 80
                        const isActive = b.status === 'active'
                        return (
                          <g key={`${b.specId}-${b.name}`}>
                            <path
                              d={`M 20 40 C ${x - 30} 40, ${x - 30} 15, ${x} 15`}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              className={isActive ? 'text-green-500' : 'text-muted-foreground'}
                            />
                            <circle
                              cx={x}
                              cy={15}
                              r="4"
                              className={isActive ? 'fill-green-500' : b.status === 'merged' ? 'fill-blue-500' : 'fill-muted-foreground'}
                            />
                            <text x={x} y="8" textAnchor="middle" className="fill-muted-foreground text-[9px]">
                              {b.name.slice(0, 8)}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  </div>
                ) : null}

                {/* 分支列表 */}
                {branchesResult?.branches.length ? (
                  <div className="max-h-[35vh] space-y-1 overflow-auto rounded-md border border-border bg-background p-2">
                    {branchesResult.branches.map((b, idx) => (
                      <div key={`${b.specId}-${b.name}-${idx}`} className="rounded-md bg-muted/40 p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <GitBranch className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium text-foreground">{b.name}</span>
                          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', BRANCH_STATUS_BADGE[b.status] || BRANCH_STATUS_BADGE.active)}>
                            {BRANCH_STATUS_LABEL[b.status] || b.status}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground" title={b.specId}>
                            spec: {b.specId.slice(0, 8)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            base: {b.baseVersion === 'latest' ? '最新' : b.baseVersion.slice(0, 8)}
                          </span>
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleMergeBranch(b.name)}
                              disabled={branchLoading || b.status !== 'active'}
                              className="flex h-6 items-center gap-1 rounded-md border border-border bg-background px-2 text-[10px] text-foreground hover:bg-muted/60 disabled:opacity-60"
                              title="合并到 main"
                            >
                              <GitMerge className="h-3 w-3" />
                              <span>合并</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDiffBranch(b.name)}
                              disabled={branchLoading}
                              className="flex h-6 items-center gap-1 rounded-md border border-border bg-background px-2 text-[10px] text-foreground hover:bg-muted/60 disabled:opacity-60"
                              title="对比 main"
                            >
                              <GitCompare className="h-3 w-3" />
                              <span>对比</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleAbandonBranch(b.name)}
                              disabled={branchLoading || b.status !== 'active'}
                              className="flex h-6 items-center gap-1 rounded-md border border-border bg-background px-2 text-[10px] text-red-600 hover:bg-red-500/10 disabled:opacity-60"
                              title="废弃分支"
                            >
                              <Square className="h-3 w-3" />
                              <span>废弃</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground p-2">
                    点击「创建分支」从当前 spec 派生新分支,支持 3-way merge + LLM 冲突解决
                  </p>
                )}

                {/* 合并冲突提示 */}
                {mergeConflicts && mergeConflicts.length > 0 && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      合并冲突({mergeConflicts.length} 处,已用 LLM 自动解决)
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {mergeConflicts.slice(0, 10).map((c, i) => (
                        <li key={i} className="text-[10px] text-amber-700 dark:text-amber-400">{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 分支 diff */}
                {branchDiffResult?.diff && (
                  <div className="rounded-md border border-border bg-background p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">
                        {branchDiffTarget} vs main
                      </span>
                      <span className="text-[10px] text-green-600">+{branchDiffResult.addedLines}</span>
                      <span className="text-[10px] text-red-600">-{branchDiffResult.removedLines}</span>
                    </div>
                    <pre className="mt-1 max-h-40 overflow-auto text-[10px] leading-4 font-mono">
                      {branchDiffResult.diff.split('\n').map((line, i) => {
                        const isAdd = line.startsWith('+') && !line.startsWith('+++')
                        const isDel = line.startsWith('-') && !line.startsWith('---')
                        return (
                          <div
                            key={i}
                            className={cn(
                              'px-1 whitespace-pre-wrap break-all',
                              isAdd && 'bg-green-500/10 text-green-700 dark:text-green-400',
                              isDel && 'bg-red-500/10 text-red-700 dark:text-red-400',
                              !isAdd && !isDel && 'text-muted-foreground',
                            )}
                          >
                            {line || ' '}
                          </div>
                        )
                      })}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* 智能生成标签页(2026-07-23 超越创新) */}
            {tabMode === 'generate' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Wand2 className="h-3 w-3 text-muted-foreground" />
                  <select
                    value={requirementFormat}
                    onChange={(e) => setRequirementFormat(e.target.value as 'text' | 'markdown' | 'image_description')}
                    className="h-7 rounded-md border border-border bg-background px-1 text-xs text-foreground focus:outline-none"
                    title="需求格式"
                  >
                    <option value="text">纯文本</option>
                    <option value="markdown">markdown</option>
                    <option value="image_description">截图描述</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleGenerateFromRequirement}
                    disabled={genLoading || !requirementInput.trim()}
                    className={cn(
                      'flex h-7 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors',
                      'bg-primary text-primary-foreground hover:bg-primary/90',
                      (genLoading || !requirementInput.trim()) && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {genLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                    <span>{genLoading ? '生成中' : '生成 spec 草稿'}</span>
                  </button>
                </div>
                <textarea
                  value={requirementInput}
                  onChange={(e) => setRequirementInput(e.target.value)}
                  placeholder={
                    requirementFormat === 'image_description'
                      ? '描述截图内容(如:登录页有用户名/密码输入框 + 登录按钮 + 找回密码链接)'
                      : '需求描述(支持 markdown,LLM 生成 5 章节 spec 草稿)'
                  }
                  rows={6}
                  className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none"
                />
                {genResult?.spec ? (
                  <div className="max-h-[45vh] overflow-auto rounded-md border border-border bg-background p-3">
                    {genResult.sections.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {genResult.sections.map((s, i) => (
                          <span key={i} className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {s.title}
                          </span>
                        ))}
                      </div>
                    )}
                    <MarkdownViewer content={genResult.spec} />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground p-2">
                    填写需求后点击「生成 spec 草稿」,LLM 生成包含 概述 / 模块结构 / API 契约 / 数据模型 / 测试用例 的 5 章节 spec
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Watch 控件(始终显示,独立于 spec 生成) */}
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-2">
        <Eye className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">文件监听</span>
        <button
          type="button"
          onClick={handleStartWatch}
          disabled={watchLoading || !activeWorkspacePath}
          className={cn(
            'flex h-6 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-foreground hover:bg-muted/60',
            (watchLoading || !activeWorkspacePath) && 'cursor-not-allowed opacity-60',
          )}
        >
          <Play className="h-3 w-3" />
          <span>启动</span>
        </button>
        <button
          type="button"
          onClick={refreshWatchStatus}
          disabled={watchLoading}
          className="flex h-6 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-foreground hover:bg-muted/60 disabled:opacity-60"
        >
          <EyeOff className="h-3 w-3" />
          <span>刷新</span>
        </button>
        {watchStatus?.watchers.length ? (
          <div className="flex flex-wrap items-center gap-1">
            {watchStatus.watchers.map((w) => (
              <span
                key={w.watchId}
                className="flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                title={`监听路径: ${w.watchPath}\n启动时间: ${w.startedAt}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span>{w.watchId.slice(0, 8)}</span>
                <button
                  type="button"
                  onClick={() => void handleStopWatch(w.watchId)}
                  className="text-red-500 hover:text-red-600"
                  title="停止监听"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">无活跃监听</span>
        )}
      </div>
    </div>
  )
}
