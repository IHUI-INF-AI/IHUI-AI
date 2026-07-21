/**
 * 模型上下文容量映射 — web 端 shim
 *
 * 实现已迁移到 packages/api-client/src/model-context-capacity.ts(跨端共享)。
 * 本文件保留 re-export 以兼容现有 `@/lib/model-context-capacity` 导入路径,
 * 避免破坏 web 端既有代码。
 */

export {
  DEFAULT_CONTEXT_CAPACITY,
  getModelContextCapacity,
  formatTokenCount,
} from '@ihui/api-client'
