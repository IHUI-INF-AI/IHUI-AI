// Spec 模式面板:共享常量与工具函数
// 从 spec-panel.tsx 抽取,供 handlers / 子组件复用。

import type { ComponentType } from 'react'
import {
  FileText,
  FolderTree,
  Box,
  GitCompare,
  Code2,
  CheckCircle,
  ListTree,
  Brain,
  Workflow,
  AlertTriangle,
  GitBranch,
  Wand2,
} from 'lucide-react'
import type { ScopeOption, TabMode } from './types'

export const SCOPE_OPTIONS: readonly ScopeOption[] = [
  { type: 'workspace', label: '工作区', icon: Box },
  { type: 'dir', label: '目录', icon: FolderTree },
  { type: 'file', label: '文件', icon: FileText },
]

export const TAB_OPTIONS: ReadonlyArray<{
  mode: TabMode
  label: string
  icon: ComponentType<{ className?: string }>
}> = [
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

export function parseSpecStatus(spec: string): string {
  if (!spec.startsWith('---')) return 'draft'
  const parts = spec.split('---', 3)
  if (parts.length < 3) return 'draft'
  for (const line of parts[1]!.split('\n')) {
    const m = line.match(/^status:\s*(.+)/)
    if (m) return m[1]!.trim()
  }
  return 'draft'
}

export const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_review: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  approved: 'bg-green-500/10 text-green-700 dark:text-green-400',
  rejected: 'bg-red-500/10 text-red-700 dark:text-red-400',
}

export const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  pending_review: '待评审',
  approved: '已通过',
  rejected: '已拒绝',
}

export const PRIORITY_BADGE: Record<string, string> = {
  P0: 'bg-red-500/10 text-red-700 dark:text-red-400',
  P1: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  P2: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  P3: 'bg-muted text-muted-foreground',
}

// 2026-07-23 超越创新:风险评分 + 流水线阶段 + 分支状态 徽章
export const RISK_BADGE: Record<string, string> = {
  low: 'bg-green-500/10 text-green-700 dark:text-green-400',
  medium: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  high: 'bg-red-500/10 text-red-700 dark:text-red-400',
}

export const RISK_LABEL: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
}

export const STAGE_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  success: 'bg-green-500/10 text-green-700 dark:text-green-400',
  failed: 'bg-red-500/10 text-red-700 dark:text-red-400',
  skipped: 'bg-muted/60 text-muted-foreground',
}

// 流水线阶段状态/阶段名 label 走 i18n(组件内 useMemo 构建,见 SpecPanel 内 stageStatusLabel/stageLabel)

export const BRANCH_STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-500/10 text-green-700 dark:text-green-400',
  merged: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  abandoned: 'bg-muted text-muted-foreground',
}

export const BRANCH_STATUS_LABEL: Record<string, string> = {
  active: '活跃',
  merged: '已合并',
  abandoned: '已废弃',
}
