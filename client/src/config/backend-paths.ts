/**
 * 后端 API 路径常量（2026-06-20 全部迁移到 Python 后端, 无 Java 依赖）
 * 所有路径、参数、字段名必须与后端一致，禁止前端自创。
 * 使用方式：path.replace('{id}', id)
 */

// ==================== ai-program 路径前缀（原 Java 8080, 已迁移到 Python 后端） ====================
/** ai-program 应用 context-path，与网关/代理一致（前端请求统一用此，如 /api/ai-program/...） */
export const JAVA_CONTEXT_PATH = '/ai-program'
/** ai-program API 完整前缀（代理后为 /api/ai-program） */
export const JAVA_API_BASE = `/api${JAVA_CONTEXT_PATH}`
/** 聊天历史路径：ZhsAiChatHistoryController，与 ihui API mobileChat 区分 */
export const JAVA_CHAT_HISTORY_PREFIX = '/ai/chat-history'
/** 聊天历史完整前缀，用于白名单/错误处理等 */
export const JAVA_CHAT_HISTORY_BASE = `${JAVA_API_BASE}${JAVA_CHAT_HISTORY_PREFIX}`

// ==================== 认证 / 登录（8080） ====================
// 2026-06-21 联调: 对齐后端 v1/auth 真实路由 (prefix=/api/v1/auth)
export const AUTH_PATHS = {
  login: '/api/v1/auth/login',
  register: '/api/v1/auth/register',
  logout: '/api/v1/auth/logout',
  profile: '/api/v1/auth/profile',
  health: '/api/v1/auth/health',
  // 验证码：走 /api/code，由 Vite 代理转发到 Python 后端 /prod-api/code，避免跨域
  code: '/api/code',
  user: '/api/v1/auth/user',
} as const

/** 2026-06-21 联调: 对齐后端 v1/auth 真实路由 */
export const LOGIN_PWD_PATHS = {
  registerLogin: '/api/v1/auth/register',
  refreshToken: '/api/v1/auth/refresh',
  editPasswd: '/api/v1/auth/profile/password',
  smsVerify: '/api/v1/auth/sms/verify',
  login: '/api/v1/auth/login',
  verify: '/api/v1/auth/sms/verify',
  replacePhone: '/api/v1/auth/profile/phone',
  setEmail: '/api/v1/auth/profile/email',
  modifyPassword: '/api/v1/auth/profile/password',
  sendBatchSms: '/api/v1/auth/sms/code',
} as const

// ==================== 开发者 API（8080 /api/developer） ====================
const DEV = '/api/developer'
export const DEVELOPER_PATHS = {
  base: DEV,
  apiKeys: `${DEV}/api-keys`,
  aiChat: {
    sessions: `${DEV}/ai/chat/sessions`,
    sessionById: (id: string) => `${DEV}/ai/chat/sessions/${id}`,
    sessionMessages: (sessionId: string) => `${DEV}/ai/chat/sessions/${sessionId}/messages`,
  },
  workflows: {
    list: `${DEV}/workflows`,
    byId: (id: string) => `${DEV}/workflows/${id}`,
    publish: (id: string) => `${DEV}/workflows/${id}/publish`,
    execute: (id: string) => `${DEV}/workflows/${id}/execute`,
    executions: (workflowId: string) => `${DEV}/workflows/${workflowId}/executions`,
    executionById: (workflowId: string, executionId: string) =>
      `${DEV}/workflows/${workflowId}/executions/${executionId}`,
    executionCancel: (workflowId: string, executionId: string) =>
      `${DEV}/workflows/${workflowId}/executions/${executionId}/cancel`,
  },
  mcp: {
    servers: `${DEV}/mcp/servers`,
    serverById: (id: string) => `${DEV}/mcp/servers/${id}`,
    test: (id: string) => `${DEV}/mcp/servers/${id}/test`,
    capabilities: (id: string) => `${DEV}/mcp/servers/${id}/capabilities`,
    tool: (serverId: string, toolName: string) =>
      `${DEV}/mcp/servers/${serverId}/tools/${toolName}`,
    resource: (serverId: string, uri: string) =>
      `${DEV}/mcp/servers/${serverId}/resources/${encodeURIComponent(uri)}`,
    prompt: (serverId: string, promptName: string) =>
      `${DEV}/mcp/servers/${serverId}/prompts/${promptName}`,
  },
  models: {
    list: `${DEV}/models`,
    byId: (id: string) => `${DEV}/models/${id}`,
    test: (id: string) => `${DEV}/models/${id}/test`,
    chat: (id: string) => `${DEV}/models/${id}/chat`,
    batch: `${DEV}/models/batch`,
    batchToggle: `${DEV}/models/batch/toggle`,
    pricing: (modelId: string) => `${DEV}/models/${modelId}/pricing`,
    proxy: (modelId: string) => `${DEV}/models/${modelId}/proxy`,
    proxyTest: (modelId: string) => `${DEV}/models/${modelId}/proxy/test`,
    proxyHealth: (modelId: string) => `${DEV}/models/${modelId}/proxy/health`,
  },
  sdks: {
    list: `${DEV}/sdks`,
    byId: (id: string) => `${DEV}/sdks/${id}`,
    generate: (id: string) => `${DEV}/sdks/${id}/generate`,
    download: (id: string) => `${DEV}/sdks/${id}/download`,
  },
  platforms: {
    list: `${DEV}/platforms`,
    byId: (id: string) => `${DEV}/platforms/${id}`,
    test: `${DEV}/platforms/test`,
    stats: `${DEV}/platforms/stats`,
    sync: (platformId: string) => `${DEV}/platforms/${platformId}/sync`,
  },
  plugins: {
    list: `${DEV}/plugins`,
    byId: (id: string) => `${DEV}/plugins/${id}`,
    publish: (id: string) => `${DEV}/plugins/${id}/publish`,
    test: (id: string) => `${DEV}/plugins/${id}/test`,
  },
  gateways: {
    list: `${DEV}/gateways`,
    byId: (id: string) => `${DEV}/gateways/${id}`,
    endpoints: (gatewayId: string) => `${DEV}/gateways/${gatewayId}/endpoints`,
    endpointDelete: (gatewayId: string, endpointId: string) =>
      `${DEV}/gateways/${gatewayId}/endpoints/${endpointId}`,
    endpointTest: (gatewayId: string, endpointId: string) =>
      `${DEV}/gateways/${gatewayId}/endpoints/${endpointId}/test`,
    stats: (gatewayId: string) => `${DEV}/gateways/${gatewayId}/stats`,
  },
  apis: {
    list: `${DEV}/apis`,
    byId: (id: string) => `${DEV}/apis/${id}`,
    test: (id: string) => `${DEV}/apis/${id}/test`,
    documentation: (id: string) => `${DEV}/apis/${id}/documentation`,
    documentationGenerate: (id: string) => `${DEV}/apis/${id}/documentation/generate`,
    documentationExport: (id: string) => `${DEV}/apis/${id}/documentation/export`,
    versions: (apiId: string) => `${DEV}/apis/${apiId}/versions`,
    versionSwitch: (apiId: string, versionId: string) =>
      `${DEV}/apis/${apiId}/versions/${versionId}/switch`,
    testCases: (apiId: string) => `${DEV}/apis/${apiId}/test-cases`,
    testCaseById: (apiId: string, testCaseId: string) =>
      `${DEV}/apis/${apiId}/test-cases/${testCaseId}`,
    testHistory: (apiId: string) => `${DEV}/apis/${apiId}/test-history`,
  },
  webhooks: {
    list: `${DEV}/webhooks`,
    byId: (id: string) => `${DEV}/webhooks/${id}`,
    test: (id: string) => `${DEV}/webhooks/${id}/test`,
    events: (id: string) => `${DEV}/webhooks/${id}/events`,
    eventTypes: `${DEV}/webhooks/events/types`,
    stats: `${DEV}/webhooks/stats`,
    batch: `${DEV}/webhooks/batch`,
  },
  statistics: {
    performance: `${DEV}/statistics/performance`,
    errors: `${DEV}/statistics/errors`,
    errorResolve: (errorId: string) => `${DEV}/statistics/errors/${errorId}/resolve`,
    export: `${DEV}/statistics/export`,
    realtime: `${DEV}/statistics/realtime`,
  },
  pricing: {
    calculate: `${DEV}/pricing/calculate`,
  },
} as const

// ==================== ihui API（原 CozeZhsApi，8000 / 生产） ====================
export const COZE_PREFIX = '/cozeZhsApi'
const COZE = COZE_PREFIX
export const COZE_PATHS = {
  aiModelInfo: {
    // 大模型统一列表接口
    // 历史问题: 此处曾硬编码 Java 域名（已迁移到 Python 后端）
    // 导致开发环境也直连生产网关 (绕过 Vite 代理, 无法走本地后端)
    // 修复: 改为相对路径 /ihui-ai-api/llm/models-unify, 由 vite.config.ts 的
    // /ihui-ai-api 代理规则统一转发 (dev->本地或生产, prod->生产)
    list: '/ihui-ai-api/llm/models-unify',
    add: `${COZE}/ai-model-info/add`,
    update: `${COZE}/ai-model-info/update`,
    delete: `${COZE}/ai-model-info/delete`,
  },
  aiModels: {
    list: `${COZE}/ai/models`,
    byId: (id: string) => `${COZE}/ai/models/${id}`,
  },
  chat: `${COZE}/chat`,
  // 2026-06-24 修复: 后端 coze SSE 端点在 /api/v1/chat/message/stream (coze.py prefix=/chat, 路由 /message/stream)
  // 不走 /cozeZhsApi 代理, 直接用 /api/v1 前缀
  chatStream: '/api/v1/chat/message/stream',
  n8n: {
    workflows: `${COZE}/n8n/workflows`,
  },
  agent: {
    search: `${COZE}/agent/search`,
    categories: `${COZE}/agent/categories`,
    favorite: (id: string) => `${COZE}/agent/${id}/favorite`,
    usage: (id: string) => `${COZE}/agent/${id}/usage`,
    reviews: (id: string) => `${COZE}/agent/${id}/reviews`,
  },
  file: {
    // 2026-06-24 修复: 后端文件上传在 /api/upload/single (upload/routes.py), 非 /cozeZhsApi/file/upload/form
    uploadForm: '/api/upload/single',
    uploadBase64: '/api/upload/base64',
    uploadOctet: (fileName: string) =>
      `/api/upload/octet?file_name=${encodeURIComponent(fileName)}`,
    uploadAgentExamine: '/api/upload/agent-examine',
    list: `${COZE}/file/list`,
    download: (filename: string) => `${COZE}/file/download/${encodeURIComponent(filename)}`,
    byId: (fileId: string) => `${COZE}/file/${fileId}`,
    fundUpload: `${COZE}/fund/file/upload`,
    mobileUploadBase64: `${COZE}/api/mobile/files/upload/base64`,
  },
  ai: {
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
  },
  payment: {
    status: (orderNo: string) => `${COZE}/payment/status/${orderNo}`,
    callbackVerify: `${COZE}/payment/callback/verify`,
    statusSync: (orderNo: string) => `${COZE}/payment/status/sync/${orderNo}`,
    cancel: (orderNo: string) => `${COZE}/payment/cancel/${orderNo}`,
    alipayCreate: `${COZE}/payment/alipay/create`,
    wechatCreate: `${COZE}/payment/wechat/create`,
    cardCreate: `${COZE}/payment/card/create`,
    refund: {
      apply: `/api/v1/refunds`,
      list: `/api/v1/refunds`,
      byRefundNo: (refundNo: string) => `/api/v1/refunds/${refundNo}`,
      cancel: (refundNo: string) => `/api/v1/refunds/${refundNo}/cancel`,
      status: (refundNo: string) => `/api/v1/refunds/${refundNo}`,
      audit: (refundNo: string) => `/api/v1/refunds/${refundNo}/review`,
      process: (refundNo: string) => `/api/v1/refunds/${refundNo}/review`,
    },
  },
  userAgentContext: {
    history: `${COZE}/user-agent-context/history`,
  },
  users: {
    meCoze: `${COZE}/users/me/coze`,
    bind: `${COZE}/users/bind`,
    refreshToken: `${COZE}/user/refresh-token`,
  },
  ws: {
    qwen: `${COZE}/ws/qwen/stream`,
    chatomni: `${COZE}/ws/chatomni/stream`,
    zhipu: `${COZE}/ws/zhipu/stream`,
    chatdeepseek: `${COZE}/ws/chatdeepseek/stream`,
    doubao: `${COZE}/ws/doubao/streamDou`,
    chat: (clientId: string) => `${COZE}/ws/chat/${clientId}`,
  },
  index: {
    resources: (type: string) => `${COZE}/index/resources/${type}`,
  },
  dashscope: {
    imageGenerate: (model: string) => `${COZE}/dashscope/image/generate/${model}`,
    imageEdit: `${COZE}/dashscope/image/edit`,
    imageToImage: `${COZE}/dashscope/image-to-image/generate`,
    visionChat: `${COZE}/dashscope/vision/chat`,
    videoGenerate: `${COZE}/dashscope/video/generate`,
    /** 通义视频合成 WebSocket 相对路径；全路径为 /cozeZhsApi/dashscope/video-synthesis/ws（由 nginx 代理到 Python 后端，ihui API） */
    videoSynthesisWs: `${COZE}/dashscope/video-synthesis/ws`,
  },
  hunyuan: {
    threeDSubmit: `${COZE}/hunyuan/3d/submit`,
    threeDQuery: `${COZE}/hunyuan/3d/query`,
  },
  kling: {
    videoIdentify: `${COZE}/kling/video/identify`,
    videoCreate: `${COZE}/kling/video/create`,
  },
  oneClickVideo: {
    start: `${COZE}/http/one_click_video/start`,
    status: (taskId: string) => `${COZE}/http/one_click_video/status/${taskId}`,
  },
  proxy: {
    doubaoImageGeneration: `${COZE}/proxy/doubao-image-generation`,
    jimeng4Image: `${COZE}/proxy/jimeng4/image`,
  },
  luyala: {
    chatCompletions: `${COZE}/luyala/chat/completions`,
    videoCreate: `${COZE}/luyala/video/create`,
  },
  doubao: {
    seedream40: `${COZE}/doubao/seedream/4.0`,
  },
  proxyOpenrouter: {
    chatCompletions: `${COZE}/proxy/openrouter/chat/completions`,
  },
  userModelChat: {
    create: `${COZE}/user-model-chat/create`,
    query: `${COZE}/user-model-chat/query`,
    updateMark: `${COZE}/user-model-chat/update/mark`,
    byId: (chatId: string) => `${COZE}/user-model-chat/${chatId}`,
  },
  userAgentContextQuery: `${COZE}/user-agent-context/query`,
  aiCareer: {
    submit: `${COZE}/ai-career/submit`,
  },
  oauthAlipay: {
    qrCode: `${COZE}/oauth/alipay/qr-code`,
    checkStatus: `${COZE}/oauth/alipay/check-status`,
    callback: `${COZE}/oauth/alipay/callback`,
  },
  tokenValue: {
    records: `${COZE}/token-value/records`,
    balance: `${COZE}/token-value/balance`,
    statistics: `${COZE}/token-value/statistics`,
    packages: `${COZE}/token-value/packages`,
    purchase: `${COZE}/token-value/purchase`,
    orderStatus: `${COZE}/token-value/order/status`,
    redeem: `${COZE}/token-value/redeem`,
  },
  developer: {
    apply: `${COZE}/developer/apply`,
    info: `${COZE}/developer/info`,
    list: `${COZE}/developer/list`,
    setIdentity: `${COZE}/developer/set-identity`,
    statusById: (id: string) => `${COZE}/developer/${id}/status`,
    permissions: `${COZE}/developer/permissions`,
  },
  topUp: {
    create: `${COZE}/top-up/create`,
    status: (orderId: string) => `${COZE}/top-up/status/${orderId}`,
  },
  agentCategory: {
    agentById: (id: string) => `${COZE}/agent-category/agent/${id}`,
    create: `${COZE}/agent-category/create`,
    byId: (id: string) => `${COZE}/agent-category/${id}`,
  },
  agentBuy: {
    create: `${COZE}/agent-buy/create`,
  },
  agentWithdrawalDetail: {
    list: `${COZE}/agent-withdrawal-detail/list`,
  },
  agentSettlement: {
    incomeOverview: `${COZE}/agent-settlement/stats/income-overview`,
    list: `${COZE}/agent-settlement/list`,
    statsOverview: `${COZE}/agent-settlement/stats/overview`,
  },
  search: {
    modelWorkflowRun: `${COZE}/search/model/workflow/run`,
  },
  mobileChat: {
    conversations: `${COZE}/api/mobile/chat/conversations`,
    conversationById: (id: string) => `${COZE}/api/mobile/chat/conversations/${id}`,
    conversationMessages: (conversationId: string) =>
      `${COZE}/api/mobile/chat/conversations/${conversationId}/messages`,
    message: `${COZE}/api/mobile/chat/message`,
    send: `${COZE}/api/mobile/chat/send`,
  },
  agents: {
    list: `${COZE}/agents/list`,
    /** 智能体全部列表，与参考项目 getAgentListAll 一致 */
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
  },
  statistics: {
    usage: `${COZE}/statistics/usage`,
    behavior: `${COZE}/statistics/behavior`,
    orders: `${COZE}/statistics/orders`,
    agents: `${COZE}/statistics/agents`,
    system: `${COZE}/statistics/system`,
  },
  cache: {
    agentCategoryDict: {
      info: `${COZE}/cache/agent-category-dict/info`,
      reload: `${COZE}/cache/agent-category-dict/reload`,
      convert: `${COZE}/cache/agent-category-dict/convert`,
      categories: `${COZE}/cache/agent-category-dict/categories`,
    },
  },
  agentExamine: {
    list: `${COZE}/agent-examine/list`,
    create: `${COZE}/agent-examine/create`,
    byId: (id: string) => `${COZE}/agent-examine/${id}`,
    statsSummary: `${COZE}/agent-examine/stats/summary`,
    approve: (id: string) => `${COZE}/agent-examine/${id}/approve`,
    reject: (id: string) => `${COZE}/agent-examine/${id}/reject`,
    syncAvatar: (agentId: string) => `${COZE}/agent-examine/sync-avatar/${agentId}`,
    batchSyncAvatar: `${COZE}/agent-examine/batch-sync-avatar`,
  },
  agentDeveloper: {
    list: `${COZE}/agent-developer/list`,
    create: `${COZE}/agent-developer/create`,
    byId: (recordId: string) => `${COZE}/agent-developer/${recordId}`,
  },
  variables: {
    base: `${COZE}/variables`,
    retrieve: `${COZE}/variables/retrieve`,
    list: `${COZE}/variables/list`,
    update: `${COZE}/variables/update`,
  },
  oauth: {
    appsList: `${COZE}/oauth/apps/list`,
    appsCreate: `${COZE}/oauth/apps/create`,
    appsById: (clientId: string) => `${COZE}/oauth/apps/${clientId}`,
  },
} as const

// ==================== 服务预约 / 通知 / 客服 / 上传（8080） ====================
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
// - rate 端点后端暂未实现, 保留路径待后端补齐
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

// ==================== 钱包（8080） ====================
// 2026-06-24 联调: 对齐后端 compat_routes.py /api/v1/wallet/* 真实路由
// - info → balance (后端提供 balance 端点, 返回余额信息)
// - transactions → transactions (后端已提供)
// - withdraw → withdraw (后端补齐, 见 compat_routes.py)
export const WALLET_PATHS = {
  info: '/api/v1/wallet/balance',
  transactions: '/api/v1/wallet/transactions',
  withdraw: '/api/v1/wallet/withdraw',
} as const

// ==================== 社区 / 工具 / 内容（8080） ====================
// 2026-06-21 联调: 子路径对齐后端 v2_community.py 真实路由
export const COMMUNITY_PATHS = {
  posts: {
    list: '/api/v2/community/posts',
    create: '/api/v2/community/post',
    batch: '/api/v2/community/posts',
    byId: (id: string) => `/api/v2/community/post?id=${id}`,
    like: (_postId: string) => `/api/v2/community/like`,
    comments: (postId: string) => `/api/v2/community/comments?postId=${postId}`,
  },
  topics: {
    list: '/api/v2/community/groups',
  },
} as const

export const API_V1_PATHS = {
  chat: { process: '/api/v1/chat/message' },
  model: { switch: '/api/v1/model/switch' },
  tools: { navigation: '/api/v1/tools/navigation' },
  agent: { upload: '/api/v1/agent/upload' },
  news: { list: '/api/v1/content/news', detail: (id: string | number) => `/api/v1/content/news/${id}` },
} as const

// 2026-06-21 联调: 子路径对齐后端 v1/tools (list/categories/upload) + v2/tools (detail/hot/favorite)
export const TOOLS_PATHS = {
  list: '/api/v1/tools/list',
  all: '/api/v1/tools/list',
  popular: '/api/v2/tools/hot',
  categories: { list: '/api/v1/tools/categories' },
  byId: (id: string) => `/api/v2/tools/detail?id=${id}`,
  use: (_id: string) => `/api/v2/tools/invoke`,
  batchUse: '/api/v2/tools/invoke',
  favorite: (_toolId: string) => `/api/v2/tools/favorite`,
  unfavorite: (_toolId: string) => `/api/v2/tools/favorite`,
} as const

// 2026-06-21 联调: 子路径对齐后端 v2_content.py 真实路由
export const CONTENT_PATHS = {
  generation: {
    text: '/api/v2/content/create',
    textBatch: '/api/v2/content/create',
    image: '/api/v2/content/create',
    video: '/api/v2/content/create',
    history: '/api/v2/content/list',
  },
} as const

// ==================== Remote（8080） ====================
export const REMOTE_PATHS = {
  agents: {
    interact: '/remote/agents/interact',
    ruleSearch: '/remote/agents/rule/search',
  },
  thumbs: '/remote/thumbs',
  collect: '/remote/collect',
  collectByAgent: (agentId: string) => `/remote/collect/${agentId}`,
  byCollect: (uuid: string) => `/remote/agent/by/collect/${uuid}`,
  byPay: '/remote/agent/by/pay',
} as const

// ==================== 文件上传 / 导出（与后端路径一致） ====================
export const UPLOAD_PATHS = {
  default: '/api/upload',
  userFeedback: { upload: '/userFeedback/upload', export: '/userFeedback/export' },
  information: { upload: '/information/upload', export: '/information/export' },
  zhs_product: { upload: '/zhs_product/upload', export: '/zhs_product/export' },
  user_vip: { upload: '/user_vip/upload', export: '/user_vip/export' },
  vip_level: { upload: '/vip_level/upload', export: '/vip_level/export' },
} as const

// ==================== 其他业务（8080） ====================
export const API_AGENTS_PATHS = {
  byId: (id: string) => `/api/agents/${id}`,
  categories: '/api/agents/categories',
  favorite: (agentId: string) => `/api/agents/${agentId}/favorite`,
  reviews: (agentId: string) => `/api/agents/${agentId}/reviews`,
} as const

export const AGENTS_LEGACY_PATHS = {
  create: '/agents',
  update: '/agents',
  delete: (ids: string) => `/agents/${ids}`,
  byId: (agentId: string) => `/agents/${agentId}`,
  labelEdit: '/agents/label/edit',
  export: '/agents/export',
  editStatus: '/agents/edit/status',
} as const

export const API_ORDERS_PATHS = {
  invoice: (orderId: string) => `/api/orders/${orderId}/invoice`,
} as const

export const API_USER_PATHS = {
  export: '/api/user/export',
  apiTokens: '/api/user/api-tokens',
  apiTokenById: (id: string) => `/api/user/api-tokens/${id}`,
  apiTokenRegenerate: (id: string) => `/api/user/api-tokens/${id}/regenerate`,
  apiUsageStats: '/api/user/api-usage/stats',
  apiUsageLogs: '/api/user/api-usage/logs',
  apiUsageLogById: (logId: string) => `/api/user/api-usage/logs/${logId}`,
  apiUsageLogsExport: '/api/user/api-usage/logs/export',
  apiBalance: '/api/user/api-balance',
  apiRechargeRecords: '/api/user/api-recharge/records',
} as const

export const API_MODELS_PATHS = {
  pricing: '/api/models/pricing',
  apiInfo: (modelId: string) => `/api/models/${modelId}/api-info`,
} as const

export const API_SERVICE_PATHS = {
  config: '/api/service/config',
} as const

export const UNIFIED_AI_PATHS = {
  composition: '/api/unified-ai/composition',
  capabilities: '/api/unified-ai/capabilities',
  performance: '/api/unified-ai/performance',
  invoke: '/api/unified-ai/invoke',
} as const

export const PRODUCT_IDENTITY_PATHS = {
  list: '/product_identity/list',
  create: '/product_identity',
  update: '/product_identity',
} as const

export const AGENT_CATEGORY_PATHS = {
  list: '/agentCategory/list',
  create: '/agentCategory',
} as const

// 2026-06-24 修复: 路径前缀对齐后端 /api/v1/*
export const COURSES_API_PATHS = {
  list: '/api/v1/courses/list',
  byId: (id: string) => `/api/v1/courses/${id}`,
  categories: '/api/v1/courses/categories',
  my: '/api/courses/my',
  enroll: (courseId: string) => `/api/courses/${courseId}/enroll`,
  progress: (courseId: string) => `/api/courses/${courseId}/progress`,
  lessonComplete: (courseId: string, lessonId: string) =>
    `/api/courses/${courseId}/lessons/${lessonId}/complete`,
} as const

export const COURSE_PATHS = {
  update: '/course',
  export: '/course/export',
  delete: (ids: string) => `/api/v1/courses/${ids}`,
} as const

export const MOBILE_ORDERS_PATHS = {
  list: '/api/mobile/orders/list',
  byId: (orderId: string) => `/api/mobile/orders/${orderId}`,
} as const

export const DEVELOPER_ORDERS_PATHS = {
  list: '/api/v1/developer/orders',
} as const

export const DISTRIBUTION_PATHS = {
  inviteCode: `${COZE}/distribution/invite-code`,
  useInviteCode: `${COZE}/distribution/use-invite-code`,
  getSubordinates: `${COZE}/distribution/getSubordinates`,
  stats: `${COZE}/distribution/stats`,
  commissionFlows: `${COZE}/distribution/commission-flows`,
  flowStatistics: `${COZE}/flow/getStatistics`,
  getWxCode: `${COZE}/login/getWxCode`,
  getUserAndChildrenOrders: `${COZE}/distribution/getUserAndChildrenOrders`,
  getUserCommissionDetail: `${COZE}/distribution/getUserCommissionDetail`,
  getUserInviteeOrderStats: `${COZE}/trader/getUserInviteeOrderStats`,
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
  automation: {
    cron: `${OPENCLAW}/automation/cron`,
    cronById: (id: string) => `${OPENCLAW}/automation/cron/${id}`,
    webhooks: `${OPENCLAW}/automation/webhooks`,
    webhookById: (id: string) => `${OPENCLAW}/automation/webhooks/${id}`,
    webhookTrigger: (id: string) => `${OPENCLAW}/automation/webhooks/${id}/trigger`,
    hooks: `${OPENCLAW}/automation/hooks`,
    hookById: (id: string) => `${OPENCLAW}/automation/hooks/${id}`,
  },
  sessions: {
    list: `${OPENCLAW}/sessions`,
    byId: (id: string) => `${OPENCLAW}/sessions/${id}`,
    messages: (id: string) => `${OPENCLAW}/sessions/${id}/messages`,
    end: (id: string) => `${OPENCLAW}/sessions/${id}/end`,
  },
  agents: {
    message: `${OPENCLAW}/agents/message`,
    status: `${OPENCLAW}/agents/status`,
    subagent: `${OPENCLAW}/agents/subagent`,
    subagents: `${OPENCLAW}/agents/subagents`,
  },
  memory: {
    create: `${OPENCLAW}/memory`,
    search: `${OPENCLAW}/memory/search`,
    context: `${OPENCLAW}/memory/context`,
    delete: `${OPENCLAW}/memory`,
  },
  evolution: {
    analyze: `${OPENCLAW}/evolution/analyze`,
    generate: `${OPENCLAW}/evolution/generate`,
    history: `${OPENCLAW}/evolution/history`,
  },
  nodes: {
    list: `${OPENCLAW}/nodes`,
    pair: `${OPENCLAW}/nodes/pair`,
    unpair: (id: string) => `${OPENCLAW}/nodes/${id}/unpair`,
    invoke: (id: string) => `${OPENCLAW}/nodes/${id}/invoke`,
  },
  stats: {
    usage: `${OPENCLAW}/stats/usage`,
    tokens: `${OPENCLAW}/stats/tokens`,
  },
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
  // 2026-06-24 联调: 协议详情页 (agreement/Index.vue) 调用, 后端待实现, 页面有 404 容错
  agreement: (type: string) => `/api/v1/settings/agreement/${type}`,
} as const
