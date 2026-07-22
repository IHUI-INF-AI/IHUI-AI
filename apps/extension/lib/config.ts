export const API_BASE_URL = 'http://localhost:8801'
/** Agent Control Bridge 端点(基于 API_BASE_URL 派生,不再硬编码 127.0.0.1:8802) */
export const BRIDGE_BASE_URL = `${API_BASE_URL}/api/agent-control`
export const TOKEN_STORAGE_KEY = 'ihui_token'
export const REFRESH_TOKEN_STORAGE_KEY = 'ihui_refresh_token'
export const EXPIRES_IN_STORAGE_KEY = 'ihui_token_expires_in'
export const REFRESH_LEAD_MS = 5 * 60 * 1000
export const TOKEN_EXPIRED_CODES = [401, 40101, 499]
export const REFRESH_ALARM_NAME = 'ihui-refresh-token'
