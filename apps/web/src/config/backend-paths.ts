/**
 * 后端路径常量 — 迁移自旧架构 client/src/config/backend-paths.ts
 * API 端点路径常量与路由映射。所有路径基于 COZE 前缀（nginx 代理到 Python 后端）
 */

const COZE = '/cozeZhsApi'

// ==================== 鉴权 / 用户（COZE） ====================
export const AUTH_PATHS = {
  login: `${COZE}/login`,
  register: `${COZE}/register`,
  logout: `${COZE}/logout`,
  refreshToken: `${COZE}/user/refresh-token`,
  captcha: `${COZE}/captcha`,
  sendSms: `${COZE}/sms/send`,
  meCoze: `${COZE}/users/me/coze`,
  bind: `${COZE}/users/bind`,
} as const

// ==================== AI（COZE） ====================
export const AI_PATHS = {
  models: `${COZE}/ai/models`,
  modelById: (id: string) => `${COZE}/ai/models/${id}`,
  chatSessions: `${COZE}/ai/chat/sessions`,
  chatSessionById: (id: string) => `${COZE}/ai/chat/sessions/${id}`,
  generate: `${COZE}/ai/generate`,
  generateStream: `${COZE}/ai/generate/stream`,
  providers: `${COZE}/ai/providers`,
  usage: `${COZE}/ai/usage`,
  chatCompletions: `${COZE}/ai/chat/completions`,
  chatCompletionsStream: `${COZE}/ai/chat/completions/stream`,
  capabilities: '/api/v1/ai/capabilities/list',
  capabilitiesCategories: '/api/v1/ai/capabilities/categories',
  capabilitiesInvoke: '/api/v1/ai/capabilities/invoke',
  capabilitiesAutoMatch: '/api/v1/ai/capabilities/auto-match',
} as const

// ==================== 文件上传（COZE） ====================
export const FILE_PATHS = {
  upload: `${COZE}/file/upload`,
  uploadBase64: `${COZE}/file/files/upload/base64`,
} as const

// ==================== WebSocket（COZE） ====================
export const WS_PATHS = {
  qwen: `${COZE}/ws/qwen/stream`,
  chatomni: `${COZE}/ws/chatomni/stream`,
  zhipu: `${COZE}/ws/zhipu/stream`,
  chatdeepseek: `${COZE}/ws/chatdeepseek/stream`,
  doubao: `${COZE}/ws/doubao/streamDou`,
  // 2026-06-29 联调: 对齐后端 /ws/chat/{room} (app/api/ws/public_socket.py)
  // 走 /ws 代理转发; 不再走不存在的 /cozeZhsApi/ws/chat/{clientId}
  chat: (clientId: string) => `/ws/chat/${clientId}`,
} as const

// ==================== 智能体（COZE） ====================
export const AGENTS_PATHS = {
  list: `${COZE}/agents/list`,
  allList: `${COZE}/agents/Alllist`,
  thumbs: `${COZE}/agents/thumbs`,
  collect: `${COZE}/agents/collect`,
  use: `${COZE}/agents/use`,
  unpublish: `${COZE}/agents/unpublish`,
  tokenBalance: (userUuid: string) => `${COZE}/agents/token/balance/${userUuid}`,
  userBilling: `${COZE}/agents/user/billing`,
  clearCache: `${COZE}/agents/clear-cache`,
  details: (agentId: string) => `${COZE}/agents/${agentId}/details`,
  fetchDetails: (agentId: string) => `${COZE}/agents/${agentId}/fetch-details`,
  billings: `${COZE}/agents/billings`,
  billingById: (billingId: string) => `${COZE}/agents/billings/${billingId}`,
} as const

// ==================== 统计（COZE） ====================
export const STATISTICS_PATHS = {
  usage: `${COZE}/statistics/usage`,
  behavior: `${COZE}/statistics/behavior`,
  orders: `${COZE}/statistics/orders`,
  agents: `${COZE}/statistics/agents`,
  system: `${COZE}/statistics/system`,
} as const

// ==================== 服务预约 / 通知 / 客服 / 钱包（8080） ====================
export const SERVICE_APPOINTMENT_PATHS = {
  base: '/api/service-appointment',
  byId: (id: string) => `/api/service-appointment/${id}`,
  cancel: (id: string) => `/api/service-appointment/${id}/cancel`,
  confirm: (id: string) => `/api/service-appointment/${id}/confirm`,
  complete: (id: string) => `/api/service-appointment/${id}/complete`,
} as const

export const NOTIFICATION_PATHS = {
  send: '/api/notification/send',
} as const

// P22-联调: 与后端 v1_customer_service.py 对齐
// - 连字符 customer-service -> 下划线 customer_service
// - 补 /v1 版本前缀
// - tickets 复数 -> ticket 单数 (后端用单数)
export const CUSTOMER_SERVICE_PATHS = {
  messages: '/api/v1/customer_service/messages',
  messagesRead: '/api/v1/customer_service/messages/read',
  tickets: '/api/v1/customer_service/ticket',
  ticketById: (ticketId: string) => `/api/v1/customer_service/ticket/${ticketId}`,
  ticketReplies: (ticketId: string) => `/api/v1/customer_service/ticket/${ticketId}/replies`,
  ticketRate: (ticketId: string) => `/api/v1/customer_service/ticket/${ticketId}/rate`,
  ticketClose: (ticketId: string) => `/api/v1/customer_service/ticket/${ticketId}/close`,
  faqs: '/api/v1/customer_service/faqs',
} as const

export const WALLET_PATHS = {
  info: '/api/wallet/info',
  transactions: '/api/wallet/transactions',
  withdraw: '/api/wallet/withdraw',
} as const

// ==================== 工具 / 内容 / 上传（8080） ====================
// 2026-06-29 修正: v2/tools 不存在, 走 v1/tools (list/categories/upload)
export const TOOLS_PATHS = {
  list: '/api/v1/tools/list',
  all: '/api/v1/tools/list',
  popular: '/api/v1/tools/list',
  categories: { list: '/api/v1/tools/categories' },
  byId: (id: string) => `/api/v1/tools/list?id=${id}`,
  use: (_id: string) => `/api/v1/tools/upload`,
  batchUse: '/api/v1/tools/upload',
} as const

// 2026-06-29 修正: v2_content.py 不存在, 走 v1/content 模块
export const CONTENT_PATHS = {
  generation: {
    text: '/api/v1/content/create',
    textBatch: '/api/v1/content/create',
    image: '/api/v1/content/create',
    video: '/api/v1/content/create',
    history: '/api/v1/content/list',
  },
} as const

export const UPLOAD_PATHS = {
  default: '/api/upload',
  userFeedback: { upload: '/userFeedback/upload', export: '/userFeedback/export' },
  information: { upload: '/information/upload', export: '/information/export' },
  zhs_product: { upload: '/zhs_product/upload', export: '/zhs_product/export' },
  user_vip: { upload: '/user_vip/upload', export: '/user_vip/export' },
  vip_level: { upload: '/vip_level/upload', export: '/vip_level/export' },
} as const

// ==================== 用户设置（相对路径，由 request baseURL 决定） ====================
export const USER_SETTINGS_PATHS = {
  base: '/user/settings',
  notifications: '/user/settings/notifications',
  privacy: '/user/settings/privacy',
  preferences: '/user/settings/preferences',
  devices: '/user/settings/devices',
  deviceById: (id: string) => `/user/settings/devices/${id}`,
  clearData: '/user/settings/clear-data',
  exportData: '/user/settings/export-data',
  deleteAccount: '/user/settings/delete-account',
  deleteAccountStatus: '/user/settings/delete-account/status',
  deleteAccountCancel: '/user/settings/delete-account/cancel',
  sendEmailCode: '/user/settings/send-email-code',
  verifyEmail: '/user/settings/verify-email',
  sendPhoneCode: '/user/settings/send-phone-code',
  verifyPhone: '/user/settings/verify-phone',
  securityLogs: '/user/settings/security-logs',
  themeSync: '/user/settings/theme/sync',
  themePresets: '/user/settings/theme/presets',
  themePresetById: (id: string) => `/user/settings/theme/presets/${id}`,
  agreement: (type: string) => `/user/settings/agreement/${type}`,
} as const

// ==================== OpenClaw（8080） ====================
const OPENCLAW = '/api/openclaw'
export const OPENCLAW_PATHS = {
  gateway: {
    status: `${OPENCLAW}/gateway/status`,
    health: `${OPENCLAW}/gateway/health`,
    config: `${OPENCLAW}/gateway/config`,
    restart: `${OPENCLAW}/gateway/restart`,
  },
  channels: {
    supported: `${OPENCLAW}/channels/supported`,
    list: `${OPENCLAW}/channels`,
    byId: (id: string) => `${OPENCLAW}/channels/${id}`,
    connect: (id: string) => `${OPENCLAW}/channels/${id}/connect`,
    disconnect: (id: string) => `${OPENCLAW}/channels/${id}/disconnect`,
    send: (id: string) => `${OPENCLAW}/channels/${id}/send`,
    status: (id: string) => `${OPENCLAW}/channels/${id}/status`,
  },
  tools: {
    list: `${OPENCLAW}/tools`,
    byName: (name: string) => `${OPENCLAW}/tools/${name}`,
    execute: (name: string) => `${OPENCLAW}/tools/${name}/execute`,
    register: `${OPENCLAW}/tools/register`,
  },
  skills: {
    list: `${OPENCLAW}/skills`,
    byId: (id: string) => `${OPENCLAW}/skills/${id}`,
    install: (id: string) => `${OPENCLAW}/skills/${id}/install`,
    uninstall: (id: string) => `${OPENCLAW}/skills/${id}/uninstall`,
    installed: `${OPENCLAW}/skills/installed`,
    publish: `${OPENCLAW}/skills/publish`,
  },
  tasks: {
    list: `${OPENCLAW}/tasks`,
    byId: (id: string) => `${OPENCLAW}/tasks/${id}`,
    cancel: (id: string) => `${OPENCLAW}/tasks/${id}/cancel`,
    retry: (id: string) => `${OPENCLAW}/tasks/${id}/retry`,
    execute: (id: string) => `${OPENCLAW}/tasks/${id}/execute`,
  },
  sessions: {
    list: `${OPENCLAW}/sessions`,
    byId: (id: string) => `${OPENCLAW}/sessions/${id}`,
    messages: (id: string) => `${OPENCLAW}/sessions/${id}/messages`,
    end: (id: string) => `${OPENCLAW}/sessions/${id}/end`,
  },
  memory: {
    create: `${OPENCLAW}/memory`,
    search: `${OPENCLAW}/memory/search`,
    context: `${OPENCLAW}/memory/context`,
    delete: `${OPENCLAW}/memory`,
  },
  stats: {
    usage: `${OPENCLAW}/stats/usage`,
    tokens: `${OPENCLAW}/stats/tokens`,
  },
} as const

// ==================== 路由映射（前端页面 -> 后端路径组） ====================
/**
 * 前端路由到后端路径组的映射，用于按页面查找所需 API 端点。
 * key 为前端路由标识，value 为该路由依赖的路径常量组
 */
export const ROUTE_MAP = {
  '/auth': AUTH_PATHS,
  '/ai': AI_PATHS,
  '/agents': AGENTS_PATHS,
  '/statistics': STATISTICS_PATHS,
  '/customer-service': CUSTOMER_SERVICE_PATHS,
  '/wallet': WALLET_PATHS,
  '/tools': TOOLS_PATHS,
  '/content': CONTENT_PATHS,
  '/settings': USER_SETTINGS_PATHS,
  '/openclaw': OPENCLAW_PATHS,
} as const

export type BackendRouteKey = keyof typeof ROUTE_MAP

/** 按前端路由 key 查询对应的后端路径组 */
export function getPathsByRoute(route: BackendRouteKey): (typeof ROUTE_MAP)[BackendRouteKey] {
  return ROUTE_MAP[route]
}
