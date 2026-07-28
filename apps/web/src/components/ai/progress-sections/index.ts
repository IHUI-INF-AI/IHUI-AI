/**
 * progress-sections 统一导出(Phase 19 集成,2026-07-28 立)
 *
 * 仅导出实际存在的组件;trae-block / question-block / resource-budget 等
 * Phase 18 组件已被其他 agent 改动,本索引按需添加(避免 export 错误)。
 */

export { TraeCodeHeader } from './trae-code-header'
export { BatchHeader, type BatchTone } from './batch-header'
export { Checklist, type ChecklistItem, type ChecklistStatus } from './checklist'
export { CompressionDivider } from './compression-divider'
export { ReferenceSection, type ReferenceItem } from './reference-section'
export { ThinkingSection } from './thinking-section'
export { FoldableSection, FoldableSectionProvider, formatDuration, formatRelativeTime } from './foldable-section'
