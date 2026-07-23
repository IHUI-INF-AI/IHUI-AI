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
// AI 自动控制跨端契约(2026-07-22 立,browser_control + computer_control MCP tool 全链路)
export * from './agent-control.js'
// 工作展示区跨端契约(2026-07-22 立,AI 对话内嵌浏览器 + URL 预览 + Artifact)
export * from './work-panel.js'
// 跨端 API 契约类型单一入口(纯类型 re-export,见 api-contracts.ts)
// 通过 @ihui/types/api-contracts subpath 访问,避免与上方散落导出冲突。
export * from './api-contracts.js'
// 命名冲突解决:agent-runtime.ts 与 workspace.ts 都导出 PermissionMode / PermissionDecision。
// agent-runtime 版本(camelCase:acceptEdits/bypassPermissions)已被 api-client 等多处引用,
// 显式 re-export 保持向后兼容;workspace 版本(kebab-case:accept-edits/bypass-permissions)
// 通过 @ihui/types/workspace subpath 访问。
export { type PermissionMode, type PermissionDecision } from './agent-runtime.js'

// 旧架构迁移补齐类型 (2026-07-22)
// 来源: git commit 3ee96cf09 旧架构 client/src/api/* 中存在但新架构未独立导出的类型
// 路由功能已迁移连通,本文件将 28 组类型定义集中到共享类型层供跨端引用
export * from './legacy-migration.js'

// IDE 工作区类型契约 (2026-07-22 立,仿 TRAE/Codex IDE 界面)
export * from './ide-workspace.js'

// 开发者 API Key 跨端契约(2026-07-22 立,统一权限点枚举 + 鉴权类型 + /v1/* 响应格式)
export * from './api-key.js'

// /v1/* 对外开放 API 端点请求/响应类型契约(2026-07-22 立,27 权限点 + 97 端点全功能覆盖)
export * from './v1-endpoints.js'

// 四层记忆 + Dream 梦境系统跨端契约(2026-07-22 立,对标 OpenClaw Mem)
export * from './memory.js'

// Webhook 触发器跨端契约(2026-07-22 立,Wave 3 W3-3 对标 OpenClaw webhook)
export * from './webhook-trigger.js'

// Webhook 唤醒机制跨端契约(2026-07-22 立,Wave 3 W3-3 简化唤醒 Bearer token)
export * from './webhook.js'

// 多通道消息总线跨端契约(2026-07-22 立,Wave 3 W3-2 对标 OpenClaw 多通道消息)
export * from './message-bus.js'

// 大模型排行榜跨端契约(2026-07-22 立,参考 arena.ai/leaderboard,6 类模型 + Agent + 总榜)
export * from './leaderboard.js'

// P3 Wave 11:6 大对标能力跨端契约(2026-07-22 立,对标 Codex/Trae/Qoder)
// 终端集成(对标 Codex/OpenCode 内置终端)
export * from './terminal.js'
// Rules 引擎(对标 Trae Rules)
export * from './rules.js'
// Hook 服务(对标 Trae Hooks)
export * from './hooks.js'
// Plan/Spec 模式(对标 Trae Plan/Spec)
export * from './spec.js'
// Context Engineering(对标 Qoder)
export * from './context-mention.js'

// 跨支柱编排中枢(2026-07-23 立,6 支柱协同 + LLM 预算 + 统一遥测)
export * from './orchestration.js'

// P3 深度层:LangGraph 升级跨端契约(2026-07-23 立,PostgresSaver + interrupt HITL + 5 模式 streaming + Time Travel)
export * from './langgraph.js'

// P3 深度层:AI 教育引擎跨端契约(2026-07-23 立,SM-2 间隔重复 + AI 助教 + AI 批改 + AI 出题)
export * from './education.js'

// 资源上游自动同步中心跨端契约(2026-07-24 立,MCP/Skill/Plugin 四源拉取 + 双路径触发 + 全量自动更新)
export * from './registry.js'
