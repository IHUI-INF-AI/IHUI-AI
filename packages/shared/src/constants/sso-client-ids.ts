/**
 * 跨端 SSO client_id 注册表
 * 集中管理各端 SSO client_id,便于后端注册表统一
 */
export const SSO_CLIENT_IDS = {
  WEB: 'web',
  EXTENSION: 'extension',
  MINIAPP_TARO: 'miniapp-taro',
  MOBILE_RN: 'mobile-rn',
  DESKTOP: 'desktop',
  CLI: 'cli',
} as const

export type SsoClientId = (typeof SSO_CLIENT_IDS)[keyof typeof SSO_CLIENT_IDS]
