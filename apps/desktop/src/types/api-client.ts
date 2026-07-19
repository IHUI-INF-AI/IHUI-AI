/**
 * 跨端 API 契约类型 — desktop 端稳定入口。
 *
 * 直接 re-export 自 `@ihui/types/api-contracts`,零冗余。
 * 端点专属运行时函数继续从 `@ihui/api-client` 导入。
 */
export type * from '@ihui/types/api-contracts'
export {
  repairMessages,
  isAIResponse,
  isWorkspaceRequest,
  isToolChunk,
  isWorkspaceEvent,
} from '@ihui/types/api-contracts'
