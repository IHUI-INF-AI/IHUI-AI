// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Spec 模式面板:事件处理 hooks(从 spec-panel.tsx 抽取)
// 所有 state / setState 由 useSpecPanel 提供,这里只负责声明 useCallback 事件处理器,
// 保持与原组件内联实现完全一致的行为(含 deps 数组),避免逻辑变化。

import * as React from 'react'
import { toast } from '@/components/common'
import { fetchApi } from '@/lib/api'
import type { SpecGenerateOutput } from '@ihui/types'
import type { SpecScopeType } from '@ihui/shared/spec'
import type {
  SpecHistoryEntry,
  SpecDiffResult,
  SpecApplyResult,
  SpecApplyConfirmResult,
  SpecReviewResult,
  SpecSplitTasksResult,
  SpecEnhanceResult,
  SpecWatchStatusResult,
  SpecFullPipelineResult,
  SpecPipelineStatusResult,
  SpecImpactAnalysisResult,
  SpecBranchesResult,
  SpecBranch,
  SpecBranchMergeResult,
  SpecBranchDiffResult,
  SpecPipelineRollbackResult,
  SpecGenerateFromRequirementResult,
} from './types'
import { STATUS_LABEL, RISK_LABEL } from './constants'

type SetState<S> = React.Dispatch<React.SetStateAction<S>>
type RequirementFormat = 'text' | 'markdown' | 'image_description'

export interface SpecPanelDeps {
  t: (key: string, values?: Record<string, string | number | Date>) => string
  activeWorkspacePath?: string
  scopeType: SpecScopeType
  scopePath: string
  result: SpecGenerateOutput | null
  history: SpecHistoryEntry[]
  setHistory: SetState<SpecHistoryEntry[]>
  diffResult: SpecDiffResult | null
  applyResult: SpecApplyResult | null
  applyLoading: boolean
  confirmLoading: boolean
  tasksResult: SpecSplitTasksResult | null
  enhanceResult: SpecEnhanceResult | null
  watchStatus: SpecWatchStatusResult | null
  pipelineResult: SpecFullPipelineResult | null
  pipelineStatus: SpecPipelineStatusResult | null
  branchesResult: SpecBranchesResult | null
  impactResult: SpecImpactAnalysisResult | null
  genResult: SpecGenerateFromRequirementResult | null
  requirementInput: string
  requirementFormat: RequirementFormat
  reviewComment: string
  branchDiffTarget: string
  autoCommit: boolean
  pipelineIdInput: string
  impactInput: string
  newBranchName: string
  branchBaseVersion: string
  tabMode:
    | 'spec'
    | 'diff'
    | 'codegen'
    | 'review'
    | 'tasks'
    | 'enhance'
    | 'pipeline'
    | 'impact'
    | 'branches'
    | 'generate'

  setScopeType: SetState<SpecScopeType>
  setScopePath: SetState<string>
  setResult: SetState<SpecGenerateOutput | null>
  setApplyResult: SetState<SpecApplyResult | null>
  setApplyLoading: SetState<boolean>
  setConfirmLoading: SetState<boolean>
  setTasksResult: SetState<SpecSplitTasksResult | null>
  setEnhanceResult: SetState<SpecEnhanceResult | null>
  setSelectedVersion: SetState<string>
  setDiffResult: SetState<SpecDiffResult | null>
  setDiffLoading: SetState<boolean>
  setTabMode: SetState<
    | 'spec'
    | 'diff'
    | 'codegen'
    | 'review'
    | 'tasks'
    | 'enhance'
    | 'pipeline'
    | 'impact'
    | 'branches'
    | 'generate'
  >
  setLoading: SetState<boolean>
  setReviewComment: SetState<string>
  setReviewLoading: SetState<boolean>
  setTasksLoading: SetState<boolean>
  setEnhanceLoading: SetState<boolean>
  setWatchStatus: SetState<SpecWatchStatusResult | null>
  setWatchLoading: SetState<boolean>
  setPipelineResult: SetState<SpecFullPipelineResult | null>
  setPipelineStatus: SetState<SpecPipelineStatusResult | null>
  setPipelineLoading: SetState<boolean>
  setAutoCommit: SetState<boolean>
  setPipelineIdInput: SetState<string>
  setImpactInput: SetState<string>
  setImpactResult: SetState<SpecImpactAnalysisResult | null>
  setImpactLoading: SetState<boolean>
  setBranchesResult: SetState<SpecBranchesResult | null>
  setBranchLoading: SetState<boolean>
  setNewBranchName: SetState<string>
  setBranchBaseVersion: SetState<string>
  setBranchDiffResult: SetState<SpecBranchDiffResult | null>
  setBranchDiffTarget: SetState<string>
  setMergeConflicts: SetState<string[] | null>
  setRequirementInput: SetState<string>
  setRequirementFormat: SetState<RequirementFormat>
  setGenResult: SetState<SpecGenerateFromRequirementResult | null>
  setGenLoading: SetState<boolean>
}

export function useSpecHandlers(deps: SpecPanelDeps) {
  const {
    t,
    activeWorkspacePath,
    scopeType,
    scopePath,
    result,
    diffResult,
    applyResult,
    tasksResult,
    pipelineResult,
    pipelineStatus,
    requirementInput,
    requirementFormat,
    reviewComment,
    autoCommit,
    pipelineIdInput,
    impactInput,
    newBranchName,
    branchBaseVersion,
    tabMode,
    setHistory,
    setResult,
    setApplyResult,
    setApplyLoading,
    setConfirmLoading,
    setTasksResult,
    setEnhanceResult,
    setSelectedVersion,
    setDiffResult,
    setDiffLoading,
    setTabMode,
    setLoading,
    setReviewLoading,
    setTasksLoading,
    setEnhanceLoading,
    setWatchStatus,
    setWatchLoading,
    setPipelineResult,
    setPipelineStatus,
    setPipelineLoading,
    setPipelineIdInput,
    setImpactResult,
    setImpactLoading,
    setBranchesResult,
    setBranchLoading,
    setNewBranchName,
    setBranchDiffResult,
    setBranchDiffTarget,
    setMergeConflicts,
    setGenResult,
    setGenLoading,
  } = deps

  // 构造 query string
  const buildQuery = React.useCallback(
    (extra: Record<string, string> = {}) => {
      const params = new URLSearchParams({
        workspacePath: activeWorkspacePath || '',
        scopeType,
        ...extra,
      })
      if (scopePath.trim()) params.set('scopePath', scopePath.trim())
      return params.toString()
    },
    [activeWorkspacePath, scopeType, scopePath],
  )

  const currentScope = React.useMemo(
    () => ({ type: scopeType, path: scopePath.trim() || undefined }),
    [scopeType, scopePath],
  )

  // 拉取历史版本列表
  const refreshHistory = React.useCallback(async () => {
    if (!activeWorkspacePath) return
    try {
      const r = await fetchApi<{ history: SpecHistoryEntry[] }>(`/api/spec/history?${buildQuery()}`)
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
      toast.error('请填写路径', {
        description: `选择 ${scopeType === 'file' ? '文件' : '目录'} 范围时需填写相对路径`,
      })
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
  const handleLoadVersion = React.useCallback(
    async (version: string) => {
      if (!activeWorkspacePath) return
      setSelectedVersion(version)
      if (version === 'latest') return
      try {
        const r = await fetchApi<{ spec: string; filePath: string }>(
          `/api/spec/load?${buildQuery({ version })}`,
        )
        if (r.success && r.data && r.data.spec) {
          setResult((prev) => (prev ? { ...prev, spec: r.data!.spec } : prev))
          setTabMode('spec')
          toast.success('已加载历史版本', { description: version })
        }
      } catch (e) {
        toast.error('加载失败', { description: e instanceof Error ? e.message : String(e) })
      }
    },
    [activeWorkspacePath, buildQuery],
  )

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
        setResult((prev) => (prev ? { ...prev, spec: r.data!.newSpec } : prev))
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
        toast.error(t('submitReviewFailed'), { description: r.error || t('unknownError') })
        return
      }
      if (r.data.spec) {
        setResult((prev) => (prev ? { ...prev, spec: r.data!.spec } : prev))
      }
      toast.success(t('reviewSubmitted'), {
        description: `状态: ${STATUS_LABEL[r.data.status] || r.data.status}`,
      })
    } catch (e) {
      toast.error(t('submitReviewFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setReviewLoading(false)
    }
  }, [activeWorkspacePath, currentScope, t])

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
        setResult((prev) => (prev ? { ...prev, spec: r.data!.spec } : prev))
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
        setResult((prev) => (prev ? { ...prev, spec: r.data!.spec } : prev))
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
        setResult((prev) => (prev ? { ...prev, spec: r.data!.spec } : prev))
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
      const r = await fetchApi<{ watchId: string; status: string; watchPath: string }>(
        '/api/spec/watch/start',
        {
          method: 'POST',
          body: JSON.stringify({ scope: currentScope, workspacePath }),
        },
      )
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
  const handleStopWatch = React.useCallback(
    async (watchId: string) => {
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
    },
    [refreshWatchStatus],
  )

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
      const r = await fetchApi<SpecPipelineStatusResult>(`/api/spec/pipeline-status?${qs}`)
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
  const handleMergeBranch = React.useCallback(
    async (branchName: string) => {
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
          toast.warning('合并完成但有冲突', {
            description: `${r.data.conflicts.length} 处冲突已用 LLM 解决`,
          })
        } else {
          toast.success('分支已合并', { description: branchName })
        }
        void refreshBranches()
      } catch (e) {
        toast.error('合并失败', { description: e instanceof Error ? e.message : String(e) })
      } finally {
        setBranchLoading(false)
      }
    },
    [activeWorkspacePath, currentScope, refreshBranches],
  )

  // 版本树:废弃分支
  const handleAbandonBranch = React.useCallback(
    async (branchName: string) => {
      const workspacePath = activeWorkspacePath
      if (!workspacePath) return
      setBranchLoading(true)
      try {
        const r = await fetchApi<{ abandoned: boolean; branchName: string }>(
          '/api/spec/branch/abandon',
          {
            method: 'POST',
            body: JSON.stringify({ scope: currentScope, workspacePath, branchName }),
          },
        )
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
    },
    [activeWorkspacePath, currentScope, refreshBranches],
  )

  // 版本树:查看分支 diff
  const handleDiffBranch = React.useCallback(
    async (branchName: string) => {
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
    },
    [activeWorkspacePath, scopeType, scopePath],
  )

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

  return {
    buildQuery,
    currentScope,
    refreshHistory,
    handleGenerate,
    handleLoadVersion,
    handleDiff,
    handleApply,
    handleApplyConfirm,
    handleSubmitReview,
    handleApprove,
    handleReject,
    handleSplitTasks,
    handleExportTasks,
    handleEnhance,
    refreshWatchStatus,
    handleStartWatch,
    handleStopWatch,
    handleRunPipeline,
    handleRefreshPipelineStatus,
    handleRollback,
    handleAnalyzeImpact,
    refreshBranches,
    handleCreateBranch,
    handleMergeBranch,
    handleAbandonBranch,
    handleDiffBranch,
    handleGenerateFromRequirement,
    handleDownload,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
