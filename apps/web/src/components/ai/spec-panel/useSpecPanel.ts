// Spec 模式面板:状态 + 事件处理聚合 hook
// 从 spec-panel.tsx 抽取。保留全部 state 与派生值,并把事件处理器委托给 useSpecHandlers。
// 对外返回 SpecPanel 渲染所需的一切(状态 + setState + handlers + 派生值)。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import type { SpecGenerateOutput } from '@ihui/types'
import type { SpecScopeType } from '@ihui/shared/spec'
import { useAiPanelStore } from '@/stores/ai-panel'
import type {
  SpecHistoryEntry,
  SpecDiffResult,
  SpecApplyResult,
  SpecSplitTasksResult,
  SpecEnhanceResult,
  SpecWatchStatusResult,
  SpecFullPipelineResult,
  SpecPipelineStatusResult,
  SpecImpactAnalysisResult,
  SpecBranchesResult,
  SpecBranchDiffResult,
  SpecGenerateFromRequirementResult,
} from './types'
import { useSpecHandlers } from './useSpecHandlers'
import { parseSpecStatus } from './constants'

export type SpecPanelApi = ReturnType<typeof useSpecPanel>

export function useSpecPanel() {
  const t = useTranslations('specPanel')
  const [scopeType, setScopeType] = React.useState<SpecScopeType>('workspace')

  // 流水线阶段状态/阶段名 label(i18n,替代原模块级硬编码常量)
  const stageStatusLabel = React.useMemo<Record<string, string>>(
    () => ({
      pending: t('stageStatus.pending'),
      running: t('stageStatus.running'),
      success: t('stageStatus.success'),
      failed: t('stageStatus.failed'),
      skipped: t('stageStatus.skipped'),
    }),
    [t],
  )
  const stageLabel = React.useMemo<Record<string, string>>(
    () => ({
      apply_spec: t('stage.apply_spec'),
      apply_patch: t('stage.apply_patch'),
      typecheck: t('stage.typecheck'),
      test: t('stage.test'),
      commit: t('stage.commit'),
    }),
    [t],
  )
  const [scopePath, setScopePath] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<SpecGenerateOutput | null>(null)
  const [history, setHistory] = React.useState<SpecHistoryEntry[]>([])
  const [selectedVersion, setSelectedVersion] = React.useState('latest')
  const [diffResult, setDiffResult] = React.useState<SpecDiffResult | null>(null)
  const [diffLoading, setDiffLoading] = React.useState(false)
  const [tabMode, setTabMode] = React.useState<
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
  >('spec')

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
  const [requirementFormat, setRequirementFormat] = React.useState<
    'text' | 'markdown' | 'image_description'
  >('text')
  const [genResult, setGenResult] = React.useState<SpecGenerateFromRequirementResult | null>(null)
  const [genLoading, setGenLoading] = React.useState(false)

  const activeWorkspacePath = useAiPanelStore((s) => s.activeWorkspace?.path)

  const handlers = useSpecHandlers({
    t,
    activeWorkspacePath,
    scopeType,
    scopePath,
    result,
    history,
    diffResult,
    applyResult,
    applyLoading,
    confirmLoading,
    tasksResult,
    enhanceResult,
    watchStatus,
    pipelineResult,
    pipelineStatus,
    branchesResult,
    impactResult,
    genResult,
    requirementInput,
    requirementFormat,
    reviewComment,
    branchDiffTarget,
    autoCommit,
    pipelineIdInput,
    impactInput,
    newBranchName,
    branchBaseVersion,
    tabMode,
    setScopeType,
    setScopePath,
    setResult,
    setHistory,
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
    setReviewComment,
    setReviewLoading,
    setTasksLoading,
    setEnhanceLoading,
    setWatchStatus,
    setWatchLoading,
    setPipelineResult,
    setPipelineStatus,
    setPipelineLoading,
    setAutoCommit,
    setPipelineIdInput,
    setImpactInput,
    setImpactResult,
    setImpactLoading,
    setBranchesResult,
    setBranchLoading,
    setNewBranchName,
    setBranchBaseVersion,
    setBranchDiffResult,
    setBranchDiffTarget,
    setMergeConflicts,
    setRequirementInput,
    setRequirementFormat,
    setGenResult,
    setGenLoading,
  })

  const showPathInput = scopeType === 'file' || scopeType === 'dir'
  const currentStatus = result?.spec ? parseSpecStatus(result.spec) : 'draft'

  return {
    t,
    activeWorkspacePath,
    scopeType,
    setScopeType,
    scopePath,
    setScopePath,
    loading,
    setLoading,
    result,
    setResult,
    history,
    setHistory,
    selectedVersion,
    setSelectedVersion,
    diffResult,
    setDiffResult,
    diffLoading,
    setDiffLoading,
    tabMode,
    setTabMode,
    applyResult,
    setApplyResult,
    applyLoading,
    setApplyLoading,
    confirmLoading,
    setConfirmLoading,
    reviewComment,
    setReviewComment,
    reviewLoading,
    setReviewLoading,
    tasksResult,
    setTasksResult,
    tasksLoading,
    setTasksLoading,
    enhanceResult,
    setEnhanceResult,
    enhanceLoading,
    setEnhanceLoading,
    watchStatus,
    setWatchStatus,
    watchLoading,
    setWatchLoading,
    pipelineResult,
    setPipelineResult,
    pipelineStatus,
    setPipelineStatus,
    pipelineLoading,
    setPipelineLoading,
    autoCommit,
    setAutoCommit,
    pipelineIdInput,
    setPipelineIdInput,
    impactInput,
    setImpactInput,
    impactResult,
    setImpactResult,
    impactLoading,
    setImpactLoading,
    branchesResult,
    setBranchesResult,
    branchLoading,
    setBranchLoading,
    newBranchName,
    setNewBranchName,
    branchBaseVersion,
    setBranchBaseVersion,
    branchDiffResult,
    setBranchDiffResult,
    branchDiffTarget,
    setBranchDiffTarget,
    mergeConflicts,
    setMergeConflicts,
    requirementInput,
    setRequirementInput,
    requirementFormat,
    setRequirementFormat,
    genResult,
    setGenResult,
    genLoading,
    setGenLoading,
    stageStatusLabel,
    stageLabel,
    showPathInput,
    currentStatus,
    ...handlers,
  }
}
