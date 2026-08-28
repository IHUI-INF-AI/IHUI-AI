// Spec 模式面板:共享类型定义(与 spec-service.ts 对齐)
// 从 spec-panel.tsx 抽取,供 handlers / 子组件复用。

import type { ComponentType } from 'react'
import type { SpecScopeType } from '@ihui/shared/spec'

export interface SpecHistoryEntry {
  timestamp: string
  filePath: string
  summary: string
}

export interface SpecDiffResult {
  oldSpec: string
  newSpec: string
  diff: string
  addedLines: number
  removedLines: number
  changedFiles: string[]
}

export interface SpecApplyResult {
  patch: string
  affectedFiles: string[]
  summary: string
  error?: string
}

export interface SpecApplyConfirmResult {
  applied: string[]
  failed: Array<{ path: string; error: string }>
  backupDir: string
}

export interface SpecReviewResult {
  spec: string
  filePath: string
  status: string
  error?: string
  currentStatus?: string
}

export interface SpecSplitTasksResult {
  tasks: Array<{
    title: string
    description: string
    priority: string
    estimated_complexity: string
  }>
  fallback?: boolean
  error?: string
}

export interface SpecEnhanceResult {
  spec: string
  enhancement: string
  filePath: string
  error?: string
  message?: string
}

export interface SpecWatchStatusResult {
  watchers: Array<{
    watchId: string
    scope: { type: string; path?: string } | null
    workspacePath: string
    webhookUrl: string | null
    startedAt: string
    watchPath: string
  }>
}

// 2026-07-23 超越创新:全流程 / 影响分析 / 版本树 / 智能生成 类型

export interface SpecPipelineStage {
  name: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  log: string
  startedAt?: string
  finishedAt?: string
}

export interface SpecFullPipelineResult {
  pipelineId: string
  stages: SpecPipelineStage[]
  overallStatus: 'running' | 'success' | 'failed' | 'partial'
  backupDir: string
  commitSha: string
  error?: string
}

export interface SpecPipelineStatusResult extends SpecFullPipelineResult {
  logs?: string[]
  ran?: boolean
}

export interface SpecPipelineRollbackResult {
  rolled: number
  errors: string[]
  backupDir: string
  error?: string
}

export interface SpecImpactAnalysisResult {
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

export interface SpecBranch {
  specId: string
  name: string
  baseVersion: string
  currentVersion: string
  createdAt: string
  status: 'active' | 'merged' | 'abandoned'
  filePath?: string
}

export interface SpecBranchesResult {
  branches: SpecBranch[]
}

export interface SpecBranchMergeResult {
  merged: boolean
  conflicts: string[]
  mergedContent: string
  branchName: string
  error?: string
}

export interface SpecBranchDiffResult {
  diff: string
  addedLines: number
  removedLines: number
  branchName: string
  specId: string
  error?: string
}

export interface SpecGenerateFromRequirementResult {
  spec: string
  sections: Array<{ title: string; level: number }>
  format: string
  error?: string
  message?: string
}

export type TabMode =
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

export interface ScopeOption {
  type: SpecScopeType
  label: string
  icon: ComponentType<{ className?: string }>
}
