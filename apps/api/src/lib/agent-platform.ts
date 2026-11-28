// 旧智能体平台集成总开关（2026-11-28 起永久关闭）
//
// 聊天链路已全部迁移到本地智能体执行。为避免任何后台按钮、管理页、OAuth 流程
// 继续向外部平台发请求，这里用编译期常量硬关闭；恢复属于显式人工决策，绝不静默回落。
export const AGENT_PLATFORM_INTEGRATION_ENABLED = false

export const AGENT_PLATFORM_DISABLED_MESSAGE = '该外部平台已停止服务，请使用本地智能体'