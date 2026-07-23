/**
 * Spec 模式跨端共享类型(2026-07-24 立,对标 TRAE Work Spec 模式四阶段生命周期)。
 *
 * 契约对齐 apps/api/src/routes/spec.ts + apps/ai-service/app/routers/spec.py:
 *  - POST /spec/generate   → SpecGenerateResult
 *  - GET  /spec/templates  → SpecTemplate[]
 *  - GET  /spec/history    → SpecHistoryEntry[]
 *  - GET  /spec/load       → SpecDocument
 *  - POST /spec/diff       → SpecDiff
 *  - GET  /spec/variables  → SpecVariable[]
 *
 * 四阶段生命周期:提案 → 审批 → 实现 → 验证
 */

/** Spec 范围类型 */
export type SpecScopeType = 'file' | 'dir' | 'workspace'

/** Spec 范围 */
export interface SpecScope {
  type: SpecScopeType
  path?: string
}

/** 生成 Spec 请求体 */
export interface SpecGenerateInput {
  scope: SpecScope
  workspacePath: string
  includeDependencies?: boolean
  languages?: string[]
}

/** Spec 模板 */
export interface SpecTemplate {
  id: string
  name: string
  description: string
  sections: string[]
}

/** Spec 文档段落 */
export interface SpecSection {
  title: string
  content: string
  level: number
}

/** 完整 Spec 文档 */
export interface SpecDocument {
  id: string
  markdown: string
  sections: SpecSection[]
  scope: SpecScope
  generatedAt: string
  stats?: {
    filesAnalyzed: number
    symbolsExtracted: number
    durationMs: number
  }
}

/** 生成结果 */
export interface SpecGenerateResult {
  spec: string
  sections: SpecSection[]
  stats: {
    filesAnalyzed: number
    symbolsExtracted: number
    durationMs: number
  }
}

/** 历史版本条目 */
export interface SpecHistoryEntry {
  id: string
  scope: SpecScope
  generatedAt: string
  summary: string
  filesAnalyzed: number
}

/** Diff 段落 */
export interface SpecDiffSection {
  title: string
  before?: string
  after?: string
  changeType: 'added' | 'removed' | 'modified' | 'unchanged'
}

/** Diff 结果 */
export interface SpecDiff {
  sections: SpecDiffSection[]
  summary: {
    added: number
    removed: number
    modified: number
    unchanged: number
  }
}

/** 模板变量 */
export interface SpecVariable {
  key: string
  label: string
  value: string
  description: string
}

/** Spec 生命周期阶段(对标 TRAE Work 四阶段) */
export type SpecLifecycleStage = 'proposed' | 'approved' | 'implementing' | 'verified'

/** Spec 生命周期状态(扩展,供 UI 显示完整流程) */
export interface SpecLifecycle {
  stage: SpecLifecycleStage
  stages: Array<{
    stage: SpecLifecycleStage
    label: string
    description: string
    completedAt?: string
    actor?: string
  }>
  proposedAt: string
  approvedAt?: string
  implementingAt?: string
  verifiedAt?: string
}

/** 预置模板(对齐 ai-service 内置 _BUILTIN_TEMPLATES) */
export const SPEC_BUILTIN_TEMPLATES: SpecTemplate[] = [
  {
    id: 'full',
    name: '完整规格',
    description: '概述 + 模块结构 + API 契约 + 数据模型 + 依赖关系(默认)',
    sections: ['概述', '模块结构', 'API 契约', '数据模型', '依赖关系'],
  },
  {
    id: 'api-only',
    name: 'API 契约',
    description: '仅提取 API endpoint,生成接口文档',
    sections: ['概述', 'API 契约'],
  },
  {
    id: 'schema-only',
    name: '数据模型',
    description: '仅提取数据库表 / schema,生成数据字典',
    sections: ['概述', '数据模型'],
  },
  {
    id: 'module-overview',
    name: '模块概览',
    description: '仅模块结构与符号清单,快速了解代码组织',
    sections: ['概述', '模块结构'],
  },
]

/** 生命周期阶段元数据 */
export const SPEC_LIFECYCLE_STAGES: Array<{ value: SpecLifecycleStage; label: string; description: string; color: string }> = [
  { value: 'proposed', label: '提案', description: 'Spec 已生成,等待审批', color: 'bg-amber-100 text-amber-700' },
  { value: 'approved', label: '审批', description: '已通过审批,可进入实现阶段', color: 'bg-blue-100 text-blue-700' },
  { value: 'implementing', label: '实现', description: '正在按 spec 实现代码', color: 'bg-purple-100 text-purple-700' },
  { value: 'verified', label: '验证', description: '已验证实现符合 spec', color: 'bg-emerald-100 text-emerald-700' },
]
