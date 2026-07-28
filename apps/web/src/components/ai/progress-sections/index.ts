/**
 * progress-sections 统一导出(2026-07-28 立,Phase 19.7-19.10)
 *
 * 子模块:
 * - trae-block: 通用 Trae Work 风格块状容器(Phase 18 极致对齐)
 * - trae-code-header: TRAE Code 头部标识 (Phase 19.7)
 * - reference-section: 参考内容折叠块 (Phase 19.7)
 * - thinking-section: 思考过程折叠子区 (Phase 19.7 升级)
 * - batch-header: 批次派发紫色星标 (Phase 19.8)
 * - checklist: 任务清单绿色对勾 (Phase 19.9)
 * - compression-divider: 历史压缩分隔线 (Phase 19.10)
 */

export { TraeBlock, ThinkingBlock, ToolResultBlock, CheckedItemsBlock, ProgressPoint, ProgressPointList } from './trae-block'
export type { TraeBlockTone } from './trae-block'

export { TraeCodeHeader } from './trae-code-header'
export { default as TraeCodeHeaderDefault } from './trae-code-header'

export { ReferenceSection } from './reference-section'
export { default as ReferenceSectionDefault } from './reference-section'

export { ThinkingSection } from './thinking-section'
export { default as ThinkingSectionDefault } from './thinking-section'

export { BatchHeader } from './batch-header'
export type { BatchHeaderTone } from './batch-header'
export { default as BatchHeaderDefault } from './batch-header'

export { Checklist } from './checklist'
export type { ChecklistItem } from './checklist'
export type { ChecklistItemStatus } from './checklist'
export { default as ChecklistDefault } from './checklist'

export { CompressionDivider } from './compression-divider'
export { default as CompressionDividerDefault } from './compression-divider'
