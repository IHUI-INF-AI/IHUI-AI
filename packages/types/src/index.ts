export * from './user.js'
export * from './api.js'
export * from './ai.js'
// CLI 配置导入(cc-switch / codex++ / 各 CLI 工具)共享类型
export * from './cli-config.js'
export * from './notification.js'
export * from './notification-channels.js'
export * from './message-repair.js'
export * from './agent-runtime.js'
export * from './workspace.js'
// 插件市场跨端类型契约(2026-07-22 立,复用 user_preferences 表)
export * from './plugin.js'
// 跨端 API 契约类型单一入口(纯类型 re-export,见 api-contracts.ts)
// 通过 @ihui/types/api-contracts subpath 访问,避免与上方散落导出冲突。
export * from './api-contracts.js'
// 命名冲突解决:agent-runtime.ts 与 workspace.ts 都导出 PermissionMode / PermissionDecision。
// agent-runtime 版本(camelCase:acceptEdits/bypassPermissions)已被 api-client 等多处引用,
// 显式 re-export 保持向后兼容;workspace 版本(kebab-case:accept-edits/bypass-permissions)
// 通过 @ihui/types/workspace subpath 访问。
export { type PermissionMode, type PermissionDecision } from './agent-runtime.js'
