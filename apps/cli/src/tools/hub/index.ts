/**
 * P1-5 Computer Hub — 三层架构模块入口。
 *
 * 三层抽象(简化版):
 *   - Layer 1 Transport:跳过(CLI 单进程,直接走 CompoundResolver)
 *   - Layer 2 ToolRegistry:InMemoryRegistry(本地工具注册表)
 *   - Layer 3 CompoundResolver:local-shadows-remote(本地覆盖远程)
 *
 * 集成接入由主会话统一处理,本模块只提供核心实现,不修改 tools/index.ts 等公共文件。
 */

export * from './registry.js'
export * from './resolver.js'
export * from './adapter.js'
export * from './mcp-adapter.js'
