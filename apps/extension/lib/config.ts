// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** 默认 API 地址(开发环境)。生产环境通过 chrome.storage.local 的 ihui_api_base_url 覆盖。 */
import { createChromePlatform } from '@ihui/browser-platform'

const platform = createChromePlatform()

const DEFAULT_API_BASE_URL = 'http://localhost:8802'

/** 默认 AI 服务地址(STT 语音识别等;与 API 服务分离,开发环境 localhost:8803)。 */
export const DEFAULT_AI_SERVICE_URL = 'http://localhost:8803'

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
 * 2026-11-07 DBG-72 收口: ihui_api_base_url 读侧零校验 —— 任何能写 storage.local 的上下文
 * 把该键改成 http://attacker 即等于把登录凭据(Authorization: Bearer)外送到第三方域。
 * 白名单:仅允许 localhost/127.0.0.1/[::1] 的 http(s)(开发/自托管)与 https://*.aizhs.top
 * (生产,与 manifest host_permissions 同域)。其余一律拒绝并告警,保持默认值。
 * 若将来要支持其他自托管域名,应有意识地同时扩 host_permissions 与本白名单,而不是放开读侧。
 */
/** @internal 导出仅为回归测试;生产代码请走 initApiBaseUrl。 */
export function isAllowedApiBaseUrl(raw: string): boolean {  try {
    const u = new URL(raw)
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      const h = u.hostname
      if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1') return true
      if (u.protocol === 'https:' && (h === 'aizhs.top' || h.endsWith('.aizhs.top'))) return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * 从 chrome.storage.local 读取用户自定义 API 地址,初始化运行时配置。
 * 开发环境默认 localhost:8802(API server);生产环境可在设置页配置。
 * 必须在应用启动时(popup/sidepanel/background)调用。
 */
export async function initApiBaseUrl(): Promise<void> {
  try {
    const customUrl = await platform.storage.localGet<string>('ihui_api_base_url')
    if (typeof customUrl === 'string' && customUrl.trim()) {
      const normalized = customUrl.trim().replace(/\/+$/, '')
      // 2026-11-07 DBG-72: 先过白名单再采纳;非法值拒绝并保留默认,绝不带凭据外发。
      if (isAllowedApiBaseUrl(normalized)) {
        _apiBaseUrl = normalized
      } else {
        console.warn(
          '[IHUI AI] ihui_api_base_url 非法(仅允许 localhost/http(s) 与 https://*.aizhs.top),已忽略:',
          customUrl,
        )
      }
    }
  } catch {
    // chrome.storage 不可用时保留默认值
  }
}

/** @deprecated 使用 getApiBaseUrl() 替代。此常量不会在 initApiBaseUrl() 后更新。 */
export const API_BASE_URL = DEFAULT_API_BASE_URL
/** @deprecated 使用 getBridgeBaseUrl() 替代。此常量不会在 initApiBaseUrl() 后更新。 */
export const BRIDGE_BASE_URL = `${DEFAULT_API_BASE_URL}/api/agent-control`
/**
 * sidepanel 通知页标记已读/全部已读后,通知 header 铃铛重拉权威未读数的同页信号。
 * 铃铛取服务端 getUnreadCount 真相(与 web 同纪律),不用本地 WS 累积条目数派生 ——
 * 后者打开即为 0、且对他端已读无感。事件名单一真相源,两个组件只 import 不硬编码。
 */
export const NOTIFICATION_UNREAD_REFRESH_EVENT = 'ihui:notification-unread-refresh'

/**
 * 广播 `notification:state` 六档翻转到达扩展后,通知列表页重拉服务端真相的同页信号。
 * 与未读数刷新事件分开:状态翻转既要刷角标,也要让已打开的列表就地更新(标记/删除/归档),
 * 两者触发点不同(前者本页标记,后者他端广播),合成一个事件会让来源不可辨。
 */
export const NOTIFICATION_STATE_REFRESH_EVENT = 'ihui:notification-state-refresh'

export {
  TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  REFRESH_LEAD_MS,
  TOKEN_EXPIRED_CODES,
  EXPIRES_IN_STORAGE_KEY,
  REFRESH_ALARM_NAME,
} from '@ihui/shared/constants'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
