/** 默认 API 地址(开发环境)。生产环境通过 chrome.storage.local 的 ihui_api_base_url 覆盖。 */
const DEFAULT_API_BASE_URL = 'http://localhost:8802'

/** 当前运行时 API base URL(由 initApiBaseUrl() 初始化)。 */
let _apiBaseUrl = DEFAULT_API_BASE_URL

/** 获取当前 API base URL。 */
export function getApiBaseUrl(): string {
  return _apiBaseUrl
}

/** Agent Control Bridge 端点(基于 API_BASE_URL 派生)。 */
export function getBridgeBaseUrl(): string {
  return `${_apiBaseUrl}/api/agent-control`
}

/**
 * 从 chrome.storage.local 读取用户自定义 API 地址,初始化运行时配置。
 * 开发环境默认 localhost:8802(API server);生产环境可在设置页配置。
 * 必须在应用启动时(popup/sidepanel/background)调用。
 */
export async function initApiBaseUrl(): Promise<void> {
  try {
    const result = await chrome.storage.local.get('ihui_api_base_url')
    const customUrl = result['ihui_api_base_url']
    if (typeof customUrl === 'string' && customUrl.trim()) {
      _apiBaseUrl = customUrl.trim().replace(/\/+$/, '')
    }
  } catch {
    // chrome.storage 不可用时保留默认值
  }
}

/** @deprecated 使用 getApiBaseUrl() 替代。此常量不会在 initApiBaseUrl() 后更新。 */
export const API_BASE_URL = DEFAULT_API_BASE_URL
/** @deprecated 使用 getBridgeBaseUrl() 替代。此常量不会在 initApiBaseUrl() 后更新。 */
export const BRIDGE_BASE_URL = `${DEFAULT_API_BASE_URL}/api/agent-control`
export {
  TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  REFRESH_LEAD_MS,
} from '@ihui/shared/constants'
export const EXPIRES_IN_STORAGE_KEY = 'ihui_token_expires_in'
export const TOKEN_EXPIRED_CODES = [401, 40101, 499]
export const REFRESH_ALARM_NAME = 'ihui-refresh-token'
