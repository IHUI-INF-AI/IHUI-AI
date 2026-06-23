/**
 * 环境工具函数
 * 集中管理环境变量读取、演示模式检测、Schema 声明
 *
 * 性能说明：Vite 在编译时把 import.meta.env.VITE_* 替换为静态值。
 * 业务代码直接用 import.meta.env.VITE_X（无函数调用开销）。
 * 本文件提供 SCHEMA 用于统一声明，validateEnv() 用于构建时校验，
 * 通用便捷函数（isDemoMode/isDev/isProd）避免重复判断。
 */

/** 环境变量 Schema - 集中声明所有 VITE_ 变量 */
const ENV_SCHEMA = {
  VITE_APP_TITLE: { default: '智汇AGI社区' },
  VITE_APP_VERSION: { default: '1.0.0' },
  VITE_APP_LOGO: { default: '/favicon.ico' },
  VITE_APP_DEMO_MODE: { default: 'false' },
  VITE_DEMO_MODE: { default: 'false' },
  VITE_LOG_LEVEL: { default: 'error' },
  VITE_API_BASE_URL: { default: '/api' },
  VITE_JAVA_API_BASE_URL: { default: '' },
  VITE_ADMIN_API_BASE: { default: '/dev-api' },
  VITE_BASE_API: { default: '/dev-api' },
  VITE_APP_BASE_API: { default: '/dev-api' },
  VITE_LLM_CHAT_URL: { default: '' },
  VITE_KOU_PROXY_PATH: { default: '/api-kou' },
  VITE_EDU_API_BASE: { default: '' },
  VITE_EDU_SSO_BASE: { default: '' },
  VITE_WS_URL: { default: '' },
  VITE_WS_BASE_URL: { default: '' },
  VITE_MONITORING_WS_URL: { default: '' },
  VITE_ENCRYPTION_KEY: { default: '' },
  VITE_REQUEST_SIGNATURE_SECRET: { default: '' },
  VITE_REQUEST_SIGNATURE_APP_ID: { default: '' },
  VITE_OAUTH2_CLIENT_ID: { default: 'web-client' },
  VITE_OAUTH2_CLIENT_SECRET: { default: '' },
  VITE_OAUTH2_TOKEN_ENDPOINT: { default: '' },
  VITE_OAUTH2_AUTHORIZATION_ENDPOINT: { default: '' },
  VITE_USE_OAUTH21: { default: 'true' },
  VITE_ENABLE_MONITOR: { default: 'true' },
  VITE_MONITOR_REPORT_URL: { default: '/api/monitor/collect' },
  VITE_ERROR_TRACKER_DSN: { default: '' },
  VITE_ERROR_TRACKER_ENV: { default: 'production' },
  VITE_WEB_VITALS_ALERT_URL: { default: '' },
  VITE_WEB_VITALS_ALERT_EMAIL: { default: '' },
  VITE_WECHAT_PC_APP_ID: { default: '' },
  VITE_WECHAT_PC_REDIRECT_URI: { default: '' },
  VITE_WEB_URL: { default: 'http://localhost:8888' },
  VITE_MAIN_APP_URL: { default: '' },
  VITE_MAIN_PROJECT_URL: { default: '' },
  VITE_ADMIN_OVERRIDE: { default: 'false' },
  VITE_ADMIN_OVERRIDE_UUID: { default: '' },
  VITE_ADMIN_OVERRIDE_PHONE: { default: '' },
  VITE_ENABLE_ZHS_AGENT_LIST: { default: 'false' },
  VITE_AGENTS_SHOW_SAMPLE_WHEN_EMPTY: { default: 'true' },
  VITE_IMAGE_PLACEHOLDER: { default: 'false' },
  VITE_ENABLE_MOCK: { default: '' },
  VITE_BAIDU_SPEECH_APP_ID: { default: 'browser' },
  VITE_BAIDU_SPEECH_API_KEY: { default: '' },
  VITE_BAIDU_SPEECH_SECRET_KEY: { default: '' },
  VITE_WHISPER_API_ENDPOINT: { default: '' },

  // 第三方登录
  VITE_GOOGLE_ENABLED: { default: 'true' },
  VITE_GOOGLE_CLIENT_ID: { default: '' },
  VITE_GOOGLE_REDIRECT_URI: { default: '' },
  VITE_GOOGLE_SCOPE: { default: 'openid email profile' },
  VITE_APPLE_ENABLED: { default: 'true' },
  VITE_APPLE_CLIENT_ID: { default: '' },
  VITE_APPLE_REDIRECT_URI: { default: '' },
  VITE_APPLE_SCOPE: { default: 'name email' },
  VITE_HUAWEI_ENABLED: { default: 'true' },
  VITE_HUAWEI_CLIENT_ID: { default: '' },
  VITE_HUAWEI_REDIRECT_URI: { default: '' },
  VITE_HUAWEI_SCOPE: { default: 'openid profile' },
  VITE_FEISHU_APP_ID: { default: '' },
  VITE_FEISHU_REDIRECT_URI: { default: '' },
  VITE_FEISHU_SCOPE: { default: 'contact:user.id:readonly' },
  VITE_DINGTALK_CORP_ID: { default: '' },
  VITE_DINGTALK_LOGIN_APP_ID: { default: '' },
  VITE_DINGTALK_REDIRECT_URI: { default: '' },
  VITE_WORKWECHAT_ENABLED: { default: 'false' },
  VITE_WORKWECHAT_REDIRECT_URI: { default: '' },
  VITE_WORKWECHAT_SCOPE: { default: 'snsapi_login' },
  VITE_WECOM_CORP_ID: { default: '' },
  VITE_ALIPAY_APP_ID: { default: '' },
  VITE_ALIPAY_REDIRECT_URI: { default: '' },
  VITE_ALIPAY_SCOPE: { default: 'auth_user' },
  VITE_WECHAT_APP_ID: { default: '' },
  VITE_BUILD_PLATFORM: { default: 'web' },
  VITE_USE_VIZE: { default: 'false' },
  VITE_ENABLE_VISUALIZER: { default: 'false' },
  VITE_DEV_HOST: { default: '0.0.0.0' },
  VITE_DEV_ORIGIN: { default: '' },
  VITE_DEV_HMR_HOST: { default: '' },
  VITE_DEV_HMR_PROTOCOL: { default: 'ws' },
} as const

/** 所有已声明的环境变量 key 列表（用于类型安全访问） */
export type EnvKey = keyof typeof ENV_SCHEMA

/** Schema 中已声明的 key 列表（运行时校验用） */
export const DECLARED_ENV_KEYS = Object.keys(ENV_SCHEMA) as EnvKey[]

/**
 * 获取环境变量值
 * 业务代码推荐直接用 import.meta.env.VITE_X（编译时静态注入，性能最优）。
 * 仅在需要 schema 兜底或动态 key 时使用此函数。
 * @param key 已声明的 VITE_ 环境变量 key
 * @param defaultValue 覆盖 schema 中的 default（用于动态生成的默认值）
 */
export function getEnv(key: EnvKey, defaultValue?: string): string {
  const schema = ENV_SCHEMA[key]
  const value = import.meta.env[key] as string | undefined
  if (value !== undefined && value !== '') return value
  return defaultValue ?? schema.default
}

/** 获取布尔型环境变量 */
export function getEnvBool(key: EnvKey): boolean {
  const v = getEnv(key).toLowerCase()
  return v === 'true' || v === '1'
}

/** 构建时校验：检查 Schema 中声明的 default 是否被正确读取 */
export function validateEnv(): string[] {
  const missing: string[] = []
  for (const key of DECLARED_ENV_KEYS) {
    const v = import.meta.env[key]
    if (v === undefined || v === '') {
      // 仅记录，不阻断（Schema 中 default 已兜底）
      missing.push(key)
    }
  }
  return missing
}

/** 检查是否为开发环境 */
export const isDev = (): boolean => import.meta.env.DEV === true

/** 检查是否为生产环境 */
export const isProd = (): boolean => import.meta.env.PROD === true

/** 获取当前构建模式 */
export const getMode = (): string => import.meta.env.MODE || 'development'

/**
 * 检查是否为演示模式
 * 通过环境变量 VITE_DEMO_MODE / VITE_APP_DEMO_MODE 或 URL 参数 demo=true 判断
 */
export const isDemoMode = (): boolean => {
  if (typeof window === 'undefined') return false
  return (
    import.meta.env.VITE_DEMO_MODE === 'true' ||
    import.meta.env.VITE_APP_DEMO_MODE === 'true' ||
    window.location.search.includes('demo=true')
  )
}

/**
 * 检查是否允许使用 Mock 数据
 * 优先读取 VITE_ENABLE_MOCK；未设置时开发环境默认允许，生产环境禁止
 */
export const isMockEnabled = (): boolean => {
  if (typeof window === 'undefined') return false
  const v = import.meta.env.VITE_ENABLE_MOCK
  if (v !== undefined) return v === 'true' || v === '1'
  return isDev()
}
