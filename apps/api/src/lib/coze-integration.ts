// Coze 集成总开关（2026-11-28 定为永久关闭）
//
// 背景：Coze 平台即将停止运营，项目已把聊天链路全部本地化。为避免任何后台按钮、
// 管理页、OAuth 流程在停运后继续向 api.coze.cn 发请求，这里用编译期常量硬关闭：
// - 路由层：routes/index.ts 不再注册 /api/coze、/api/coze/oauth、coze-test
// - 服务层：同步/OAuth 入口直接抛 COZE_DISABLED（410），不再取 token、不再 fetch
// - 凭据层：.env 中 COZE_* 凭据已清空，私钥文件已移除
// 恢复需要同时改回本常量并重新配置凭据，属于显式人工决策，绝不静默回落。
export const COZE_INTEGRATION_ENABLED = false

export const COZE_DISABLED_MESSAGE =
  'Coze 平台已停止运营，本项目已彻底停用 Coze 集成（本地智能体不受影响）'
