/**
 * OpenAPI 元数据工具(2026-07-28 立,P0-4a Swagger 公开暴露策略)。
 *
 * 统一维护 /docs 文档的:
 * - 品牌信息(IHUI AI 平台 + 版本号 + 联系邮箱)
 * - 标准化 tags 列表
 * - 版本号(从 apps/api/package.json 派生,避免硬编码漂移)
 *
 * 被 server.ts(swagger 注册)与 openapi-helpers.test.ts 引用。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** 从 apps/api/package.json 读取运行时版本号,缺省 '1.0.0'。 */
function readApiVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', '..', 'package.json')
    const raw = readFileSync(pkgPath, 'utf8')
    const parsed = JSON.parse(raw) as { version?: string }
    return parsed.version ?? '1.0.0'
  } catch {
    return '1.0.0'
  }
}

/** IHUI AI 平台统一联系邮箱。 */
export const IHUI_CONTACT_EMAIL = 'api@ihui.ai'

/** IHUI AI 平台统一文档/品牌信息。 */
export const IHUI_OPENAPI_INFO = {
  title: 'IHUI AI API',
  version: readApiVersion(),
  description: [
    'IHUI AI 平台对外公开 API + 内部管理 API(v1)。',
    '',
    '## 鉴权',
    '- 用户态路由:`Authorization: Bearer <jwt>` 或 `auth_token` Cookie',
    '- 开发者 API Key:`Authorization: Bearer ihui_xxx` 或 `X-Api-Key: ihui_xxx`',
    '- 内部服务:`X-Internal-Service-Token` + `X-User-Id`',
    '',
    '## 响应格式',
    '所有接口统一返回 `{ code, message, data }`,code=0 表示成功。',
    '',
    '## 联系',
    `问题反馈: ${IHUI_CONTACT_EMAIL}`,
  ].join('\n'),
  contact: {
    name: 'IHUI AI Platform Team',
    email: IHUI_CONTACT_EMAIL,
    url: 'https://ihui.ai',
  },
  license: {
    name: 'Proprietary',
    url: 'https://ihui.ai/license',
  },
} as const

/** OpenAPI tags 标准化列表(与 apps/api/src/routes/* 保持一致,顺序按业务优先级)。 */
export const IHUI_OPENAPI_TAGS = [
  { name: 'Agents', description: 'Agent 管理与调用(创建/查询/调用 Agent)' },
  { name: 'Chat', description: '聊天补全(OpenAI 兼容 /api/v1/chat/completions)' },
  { name: 'Models', description: '模型列表与路由(StepFun / Agnes / OpenAI / Claude / Gemini ...)' },
  { name: 'Files', description: '文件管理(上传/下载/直传 OSS)' },
  { name: 'AI Core', description: 'AI 核心能力(嵌入 / 视觉 / MOA 路由)' },
  { name: 'Multimodal', description: '多模态(图片生成 / 视频生成 / TTS)' },
  { name: 'Knowledge', description: '知识库工具(检索 / RAG / 文档管理)' },
  { name: 'Debug', description: 'DAP 调试器(断点 / 单步 / 变量)' },
  { name: 'Terminal', description: '终端 PTY 管理(创建 / 读写 / 关闭)' },
  { name: 'Auth', description: '认证(登录 / 注册 / 2FA / Token 刷新)' },
  { name: 'Users', description: '用户管理(资料 / 偏好 / 注销)' },
  { name: 'Wallet', description: '钱包与积分(余额 / 充值 / 流水)' },
  { name: 'Finance', description: '财务(订单 / 退款 / 对账)' },
  { name: 'Payment', description: '支付(微信 / PayPal / 支付宝)' },
  { name: 'Order', description: '订单管理(创建 / 状态 / 履约)' },
  { name: 'Billing', description: '计费(套餐 / 用量 / 账期)' },
  { name: 'Settings', description: '系统设置(用户级 / 平台级)' },
  { name: 'Admin', description: '管理后台(仅 role>=1 可访问)' },
  { name: 'Webhooks', description: '异步回调(支付 / 直播 / 设备事件)' },
  { name: 'Public', description: '公开接口(健康检查 / 落地页 / 公开配置)' },
] as const
