// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export * from './user'
// 跨端设备指纹采集契约(2026-08-02 立,设备维度风控,仿 use-clipboard 工厂模式)
// 放 @ihui/types 避免与 @ihui/api-client 循环依赖(shared→api-client,api-client→types)
export * from './device'
export * from './api'
// Token 对跨端共享类型(4 端统一引用,取代各端本地重复定义)
export * from './token'
export * from './ai'
// CLI 配置导入(cc-switch / codex++ / 各 CLI 工具)共享类型
export * from './cli-config'
export * from './notification'
export * from './notification-channels'
export * from './message-repair'
export * from './agent-runtime'
export * from './workspace'
// 插件市场跨端类型契约(2026-07-22 立,复用 user_preferences 表)
export * from './plugin'
// AI 自动控制跨端契约(2026-07-22 立,browser_control + computer_control MCP tool 全链路)
export * from './agent-control'
// 工作展示区跨端契约(2026-07-22 立,AI 对话内嵌浏览器 + URL 预览 + Artifact)
export * from './work-panel'
// 跨端 API 契约类型单一入口(纯类型 re-export,见 api-contracts.ts)
// 通过 @ihui/types/api-contracts subpath 访问,避免与上方散落导出冲突。
export * from './api-contracts'
// 命名冲突解决:agent-runtime.ts 与 workspace.ts 都导出 PermissionMode / PermissionDecision。
// agent-runtime 版本(camelCase:acceptEdits/bypassPermissions)已被 api-client 等多处引用,
// 显式 re-export 保持向后兼容;workspace 版本(kebab-case:accept-edits/bypass-permissions)
// 通过 @ihui/types/workspace subpath 访问。
export { type PermissionMode, type PermissionDecision } from './agent-runtime'
// 权限模式唯一真源(G-161):跨端/跨语言注册表 + 别名归一,详见 permission-mode.ts 头注
export * from './permission-mode'

// 旧架构迁移补齐类型 (2026-07-22)
// 来源: git commit 3ee96cf09 旧架构 client/src/api/* 中存在但新架构未独立导出的类型
// 路由功能已迁移连通,本文件将 28 组类型定义集中到共享类型层供跨端引用
export * from './legacy-migration'

// IDE 工作区类型契约 (2026-07-22 立,自研 IDE 界面)
export * from './ide-workspace'

// 开发者 API Key 跨端契约(2026-07-22 立,统一权限点枚举 + 鉴权类型 + /v1/* 响应格式)
export * from './api-key'
export * from './capability-catalog'

// /v1/* 对外开放 API 端点请求/响应类型契约(2026-07-22 立,27 权限点 + 97 端点全功能覆盖)
export * from './v1-endpoints'

// 四层记忆 + Dream 梦境系统跨端契约(2026-07-22 立,对标 OpenClaw Mem)
export * from './memory'

// Webhook 触发器跨端契约(2026-07-22 立,Wave 3 W3-3 对标 OpenClaw webhook)
export * from './webhook-trigger'

// Webhook 唤醒机制跨端契约(2026-07-22 立,Wave 3 W3-3 简化唤醒 Bearer token)
export * from './webhook'

// 多通道消息总线跨端契约(2026-07-22 立,Wave 3 W3-2 对标 OpenClaw 多通道消息)
export * from './message-bus'

// 大模型排行榜跨端契约(2026-07-22 立,参考 arena.ai/leaderboard,6 类模型 + Agent + 总榜)
export * from './leaderboard'

// P3 Wave 11:6 大核心能力跨端契约(2026-07-22 立)
// 终端集成(对标 Codex/OpenCode 内置终端)
export * from './terminal'
// Rules 引擎()
export * from './rules'
// Hook 服务( Hooks)
export * from './hooks'
// Plan/Spec 模式( Plan/Spec)
export * from './spec'
// ChatMode × 工具可用性策略唯一真源(V3 #53):收窄矩阵 + 只读白名单快照
export * from './chat-mode-policy'
// Context Engineering(对标 Qoder)
export * from './context-mention'

// 跨支柱编排中枢(2026-07-23 立,6 支柱协同 + LLM 预算 + 统一遥测)
export * from './orchestration'

// P3 深度层:LangGraph 升级跨端契约(2026-07-23 立,PostgresSaver + interrupt HITL + 5 模式 streaming + Time Travel)
export * from './langgraph'

// P3 深度层:AI 教育引擎跨端契约(2026-07-23 立,SM-2 间隔重复 + AI 助教 + AI 批改 + AI 出题)
export * from './education'

// 资源上游自动同步中心跨端契约(2026-07-24 立,MCP/Skill/Plugin 四源拉取 + 双路径触发 + 全量自动更新)
export * from './registry'

// 跨端 app 组件类型契约(从 packages/app 迁移,2026-07-25)
export * from './app'

// Coze 平台 API 跨端契约(2026-07-27 立,PAT 直连 Coze 官方 API,chat/workflow/bot/dataset)
export * from './coze'

// 跨端支付参数类型(2026-07-28 立,从 miniapp-taro 下沉:PayPlatform/WxPayParams/AliPayParams/AnyPayParams)
export * from './pay'

// 跨端分享信息类型(2026-07-28 立,从 miniapp-taro 下沉:ShareInfo/TimelineShareInfo)
export * from './share'

// Skill 市场「启停」(用户级启用/停用)跨端共享类型(2026-09 立,第三梯队 #14)
export * from './skill-market'

// 跨端同名组件共享 props 类型(2026-07-28 立,mobile-rn + miniapp-taro 14 对组件类型去重)
export * from './ui-native-components'

// Admin 后台业务类型契约(2026-07-28 立,从 apps/web/app/(main)/admin/**/types.ts 9 个文件下沉)
export * from './admin-types'

// IM 多平台远程连接控制跨端契约(2026-07-31 立,P0 admin/im-channels 配套)
// 16 平台元数据 + 适配器配置 + 网关状态 + 消息历史 + 富卡片类型
// 显式 re-export 解决与 agent-runtime.ts 旧版 Im* 类型的同名冲突(TS2308);
// im-gateway.ts 为整合后的最新版本(字段更全:ImMessageType +approval / ImAdapterConfig +useLarkCli)
export {
  type ImPlatform,
  type ImMessageDirection,
  type ImMessageType,
  type ImInboundMessage,
  type ImOutboundMessage,
  type ImAdapterConfig,
  type ImGatewayStatus,
  type ImRichCard,
  type ImCardElement,
  type ImCardAction,
  type ImFileMessage,
  type ImAudioVideoMessage,
  type ImApprovalMessage,
  type ImMessageHistoryItem,
  type ImAdapterUpsertInput,
  type ImAdapterFieldSchema,
  type ImPlatformMeta,
} from './im-gateway'

// 下载量统计跨端契约(2026-08-06 立,8 端下载点击上报 + 统计类型)
export * from './download'

// 模型分类契约(2026-08-29 立,用途分类 + 代次档位,决定模型选择器默认展示 vs 折叠)
export * from './model-catalog'

// 跨端聊天消息类型契约(2026-09-12 立,自 packages/shared/src/hooks/use-chat.ts 迁移;
// 该文件的死抽象 useChat hook 已删除,仅保留被跨端真实引用的类型定义)。
export * from './chat'
// 命名冲突解决:ai.ts 内有历史遗留极简 ChatMessage(role/content 两字段)与 BaseToolCall,
// chat.ts 为完整版(含 toolCalls/reasoning/meta/subagentActivities 等字段)。
// 显式 re-export chat.ts 版本作为主入口语义;ai.ts 极简版继续经 @ihui/types/ai 与
// @ihui/types/api-contracts 使用(api-contracts 的 ChatRequest 依赖极简版,不受影响)。
export { type ChatMessage, type BaseToolCall } from './chat'

// 工具契约声明面 + 同源投影(A13 第一阶段,2026-09-25 立):副作用范围词表 + 两个"缺省即
// 不可信"派生谓词,以及"运行时校验器 → provider 可见 JSON Schema"的唯一出口。经包主入口导出
// 是刻意的 —— config/architecture-policy.yaml 的 packages/types.public_entrypoints 只声明了
// '.' 与既有若干子路径,新增子路径属该表的持有者(守门 103 D3 按这张表判深导入)。
export * from './tool-contract'
export * from './schema-projection'
// 出站事实(egress facts)闭集形状:一趟请求"实际走没走代理 / 配置从哪来 / 是否命中 NO_PROXY /
// 有没有自定义 CA"必须是**响应上的返回值**而不是日志行 —— AGENTS §5b 那三条"网络时通时不通"的
// 排查全靠人肉现读,根因就是这里没人把事实带回来。只经主入口导出(同上,不新增子路径)。
export * from './egress-facts'
// D30 无人值守修复闭环(G-36,2026-09-26 立):修复任务记录 + 状态机迁移契约。
// 只经主入口导出(不新增子路径,同 tool-contract / egress-facts 的口径)。
export * from './automation-repair'
// Error 序列化唯一出口(2026-09-26 立):JSON.stringify(Error) === "{}"(name/message/
// stack/cause 均为非枚举自有属性),凡把 error 对象塞进日志/响应/IPC 的现场都会退化成
// 空对象。serializeError 输出闭集结构(未知字段一律不带出),循环 cause 与深度封顶处
// 显式 truncated 标注。只经主入口导出(同上,不新增子路径)。
export * from './error-serialize'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
