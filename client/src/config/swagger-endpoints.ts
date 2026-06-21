import { t } from '@/utils/i18n'

/**
 * 后端 Swagger API 文档地址与路径配置
 *
 * 命名规范：路径名、参数名、接口名、字段名必须与 8080/8000 后端一致，禁止前端自创。
 * 详见 docs/BACKEND_API_NAMING.md
 *
 * 本文件记录后端 Swagger 地址与 API_ENDPOINTS，所有接口已通过 Vite 代理接通（vite.config.ts）。
 */

/**
 * 代理配置状态
 * ✅ = 已在 vite.config.ts 中配置代理
 */
export const PROXY_STATUS = {
  javaBackend: '✅ 已配置 - Python 后端 /ai-program（原 Java 8080, 2026-06-20 已迁移）',
  productionAI: '✅ 已配置 - Python 后端 /cozeZhsApi（ihui API, 原 zca.aizhs.top 已迁移）',
}

/**
 * 后端服务配置
 */
export const BACKEND_SERVICES = {
/**
 * Java 主后端服务（已迁移到 Python 后端）
 * ✅ 已通过 Vite 代理接通
 */
  javaBackend: {
    name: '主后端服务（原 Java, 已迁移到 Python）',
    description: t('text.swagger_endpoints.Java后端服务描述'),
    baseUrl: '/prod-api',
    swaggerUrl: '/prod-api/swagger-ui/index.html',
    apiDocsUrl: '/prod-api/ai-program/v3/api-docs',
    apiPrefix: '/ai-program',
    proxyStatus: '✅ 已接通',
    modules: [
      {
        name: 'ai-program',
        description: t('text.swagger_endpoints.AI程序模块包含1'),
        docsPath: '/ai-program/v3/api-docs',
      },
      // system 模块已移除
    ],
  },

  /**
   * Python AI 服务（FastAPI）
   */
  pythonAI: {
    name: 'Python AI 服务',
    description: t('text.swagger_endpoints.FastAPI后3'),
    baseUrl: 'http://localhost:8000',
    swaggerUrl: 'http://localhost:8000/docs',
    apiPrefix: '/api/v1',
    proxyStatus: '⚠️ 待配置',
  },

  /**
   * 生产环境 AI 服务
   * ✅ 已通过 Vite 代理接通
   */
  productionAI: {
    name: '生产环境 AI 服务',
    description: t('text.swagger_endpoints.线上AI服务包含4'),
    baseUrl: '',
    apiPrefix: '/cozeZhsApi',
    proxyStatus: '✅ 已接通',
  },
}

/**
 * 已配置代理的接口路径列表
 *
 * 这些路径已在 vite.config.ts 中配置代理，前端可直接使用：
 * - 前端请求：/xxx/list
 * - 实际转发：/prod-api/ai-program/xxx/list（由 nginx 代理到 Python 后端）
 */
export const PROXIED_PATHS = [
  // 用户相关
  '/zhs_user',
  '/users',
  '/user_vip',
  '/userVideoLog',
  '/userVideoComment',
  '/userSysLink',
  '/userPlatform',
  '/userFeedback',
  '/userCommentLog',
  '/userAgentImage',
  '/userAgentContext',
  '/userAgentAudio',
  '/userMargin',
  '/userIdentity',
  '/userToken',

  // 智能体相关
  '/zhsAgent',
  '/zhsIdentity',

  // 产品/活动相关
  '/zhs_product',
  '/zhs_activity',
  '/product_identity',

  // VIP/会员相关
  '/vip_level',
  '/vipLevel',
  '/vipProgress',

  // 订单/支付相关
  '/order',
  '/withdrawal_flow',
  '/withdrawal_detail',
  '/token_flow',
  '/flow',

  // 开发者相关
  '/developer',
  '/developerLink',
  '/developerFundLogs',
  '/taskDeveloper',

  // 课程/教育相关
  '/courses',
  '/educationPlatform',

  // 审核相关
  '/examine',

  // 管理后台 API
  '/admin',

  // 需求广场（走 /api 代理，后端路径 /ai-program/plaza/demands）
  '/api/ai-program/plaza',

  // 其他业务接口
  '/banner',
  '/advertise',
  '/information',
  '/dictionary',
  '/organization',
  '/powerPurchaseRule',
  '/identity_proportion',
  '/login_logs',
  '/verificationCode',
  '/smsTemplate',
  '/thirdPartyAccount',

  // 生产环境 AI 接口
  '/cozeZhsApi',
]

/**
 * 主要 API 接口列表（2026-06-20 已全部迁移到 Python 后端）
 *
 * 路径说明：
 * - 完整路径 = baseUrl + apiPrefix + path
 * - 例如：/prod-api/ai-program/zhsAgent/list（由 nginx 代理到 Python 后端）
 * - 前端直接使用：/zhsAgent/list（通过 Vite 代理自动转发）
 */
export const API_ENDPOINTS = {
  // ==================== 用户相关 ====================
  user: {
    list: '/zhs_user/list', // GET - 获取用户列表
    detail: '/zhs_user/{id}', // GET - 获取用户详情
    create: '/zhs_user', // POST - 创建用户
    update: '/zhs_user', // PUT - 更新用户
    delete: '/zhs_user/{ids}', // DELETE - 删除用户
    export: '/zhs_user/export', // POST - 导出用户
  },

  // ==================== 用户中心 ====================
  users: {
    list: '/users/list', // GET - 用户列表
    detail: '/users/{uuid}', // GET - 用户详情
    vipInfo: '/users/vipInfo/{uuid}', // GET - 用户VIP信息
    platformList: '/users/platform/list', // GET - 平台用户列表
    coursePlatform: '/users/course/platform', // GET - 课程平台
    setIdentity: '/users/set/user/identity', // POST - 设置用户身份
  },

  // ==================== 智能体相关 ====================
  agent: {
    list: '/zhsAgent/list', // GET - 获取智能体列表
    detail: '/zhsAgent/{id}', // GET - 获取智能体详情
    create: '/zhsAgent', // POST - 创建智能体
    update: '/zhsAgent', // PUT - 更新智能体
    delete: '/zhsAgent/{ids}', // DELETE - 删除智能体
    export: '/zhsAgent/export', // POST - 导出智能体
  },

  // ==================== 产品相关 ====================
  product: {
    list: '/zhs_product/list', // GET - 获取产品列表
    detail: '/zhs_product/{id}', // GET - 获取产品详情
    create: '/zhs_product', // POST - 创建产品
    update: '/zhs_product', // PUT - 更新产品
    delete: '/zhs_product/{ids}', // DELETE - 删除产品
  },

  // ==================== 活动相关 ====================
  activity: {
    list: '/zhs_activity/list', // GET - 获取活动列表
    detail: '/zhs_activity/{id}', // GET - 获取活动详情
    create: '/zhs_activity', // POST - 创建活动
    update: '/zhs_activity', // PUT - 更新活动
    status: '/zhs_activity/activityStatus', // POST - 更新活动状态
  },

  // ==================== 身份管理 ====================
  identity: {
    list: '/zhsIdentity/list', // GET - 获取身份列表
    detail: '/zhsIdentity/{id}', // GET - 获取身份详情
    create: '/zhsIdentity', // POST - 创建身份
    update: '/zhsIdentity', // PUT - 更新身份
  },

  // ==================== VIP 等级 ====================
  vipLevel: {
    list: '/vip_level/list', // GET - 获取VIP等级列表
    detail: '/vip_level/{id}', // GET - 获取VIP等级详情
  },

  // ==================== 开发者相关 ====================
  developer: {
    list: '/developer/list', // GET - 开发者列表
    detail: '/developer/{id}', // GET - 开发者详情
    create: '/developer', // POST - 创建开发者
    update: '/developer', // PUT - 更新开发者
  },

  // ==================== 订单相关 ====================
  order: {
    list: '/zhs_order/list', // GET - 订单列表
  },

  // ==================== 提现相关 ====================
  withdrawal: {
    list: '/withdrawal_flow/list', // GET - 提现列表
    approve: '/withdrawal_flow/{id}/approve', // PUT - 审批提现
  },

  // ==================== 佣金相关 ====================
  commission: {
    list: '/commission/list', // GET - 佣金列表
  },

  // ==================== 课程相关 ====================
  courses: {
    list: '/courses/list', // GET - 课程列表
    detail: '/courses/{id}', // GET - 课程详情
  },

  // ==================== 轮播图 ====================
  banner: {
    list: '/banner/list', // GET - 轮播图列表
  },

  // ==================== 用户资金 ====================
  userMargin: {
    list: '/userMargin/list', // GET - 用户资金列表
    detail: '/userMargin/{id}', // GET - 用户资金详情
  },

  // ==================== 广告管理 ====================
  advertise: {
    list: '/advertise/list', // GET - 广告列表
  },

  // ==================== 需求广场 ====================
  // 与 Java 后端 8080 一致：实际路径为 /ai-program/plaza/demands，经 /api 代理转发（不加重写 /prod-api）
  plaza: {
    list: '/api/ai-program/plaza/demands/list',   // GET 参数: page, pageSize, category, status(1|2)
    create: '/api/ai-program/plaza/demands',      // POST 请求体: CreatePlazaDemandRequest
    detail: '/api/ai-program/plaza/demands/{id}',
    batch: '/api/ai-program/plaza/demands/batch',
    userFollow: '/api/ai-program/plaza/users/{userId}/follow',
    commentLike: '/api/ai-program/plaza/comments/{commentId}/like',
    commentUnlike: '/api/ai-program/plaza/comments/{commentId}/unlike',
  },
}

/**
 * ihui API（cozeZhsApi）接口（2026-06-20 已全部迁移到 Python 后端）
 *
 * 注意：这些接口已通过 Python 后端实现，走相对路径由 nginx 代理转发
 */
export const COZE_ZHS_API_ENDPOINTS = {
  // AI 模型信息 - 需要后端实现
  aiModelInfo: {
    // 统一大模型列表接口（走相对路径, 由 nginx 代理到 Python 后端）
    list: '/ihui-ai-api/llm/models-unify', // GET - 获取AI模型列表
    add: '/cozeZhsApi/ai-model-info/add', // POST - 添加AI模型
    update: '/cozeZhsApi/ai-model-info/update', // POST - 更新AI模型
    delete: '/cozeZhsApi/ai-model-info/delete', // GET - 删除AI模型
  },

  // AI 模型（备用接口）
  aiModels: {
    list: '/cozeZhsApi/ai/models', // GET - 获取AI模型列表
  },

  // 统计相关
  statistics: {
    usage: '/cozeZhsApi/statistics/usage', // GET - 使用统计
    behavior: '/cozeZhsApi/statistics/behavior', // GET - 行为统计
    orders: '/cozeZhsApi/statistics/orders', // GET - 订单统计
  },
}

/**
 * 打开 Swagger 文档
 * @param service 服务名称
 */
export function openSwaggerDocs(service: keyof typeof BACKEND_SERVICES = 'javaBackend') {
  const config = BACKEND_SERVICES[service]
  if ('swaggerUrl' in config && config.swaggerUrl) {
    window.open(config.swaggerUrl, '_blank')
  }
}

export default {
  BACKEND_SERVICES,
  API_ENDPOINTS,
  COZE_ZHS_API_ENDPOINTS,
  openSwaggerDocs,
}
