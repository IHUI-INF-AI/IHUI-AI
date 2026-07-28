/**
 * miniapp-taro 端 storage key 集中管理
 *
 * 命名说明:
 * - 跨端共享 key(值一致)从 @ihui/shared/constants 引入并 re-export,避免重复
 * - 端独占 key / 历史遗留 key(值与共享包不同)在本地定义,保留实际值向后兼容:
 *   * LOCALE_KEY='lang'           共享包为 'ihui-locale' — 不可替换,否则丢失用户语言偏好
 *   * THEME_KEY='theme'           共享包为 'ihui-theme' — 不可替换
 *   * USER_INFO_LEGACY_KEY='ihui_user_info'(下划线)  共享包为 'ihui-user-info'(连字符)
 *     auth.ts 已做双读迁移;share.ts 读 legacy key 保兼容
 *
 * 各页面禁止本地硬编码 storage key 字符串,必须 import 本文件常量。
 */

import {
  TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  INVITE_CODE_STORAGE_KEY,
  VIP_STORAGE_KEY,
} from '@ihui/shared/constants'

// 跨端共享(值一致,re-export 统一入口)
export { TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY, INVITE_CODE_STORAGE_KEY, VIP_STORAGE_KEY }

// 端独占 / 历史遗留 key(保留实际值,向后兼容)
export const LOCALE_KEY = 'lang' as const
export const THEME_KEY = 'theme' as const
export const USER_INFO_LEGACY_KEY = 'ihui_user_info' as const

// storage key 前缀(用于 app.tsx 内存清理时识别 ihui_ 前缀的 key)
export const IHUI_KEY_PREFIX = 'ihui_' as const

// AI 相关
export const IMAGE_HISTORY_KEY = 'ihui_image_history' as const
export const IMAGE_FAVORITES_KEY = 'ihui_image_favorites' as const
export const VIDEO_HISTORY_KEY = 'ihui_video_history' as const
export const AI_AGENT_TIP_SHOWN_KEY = 'ai_agent_tip_shown' as const
export const AGENT_DIALOGUE_DATA_KEY = 'ihui-agent-dialogue-data' as const

// 业务相关
export const BUSINESS_CARD_DATA_KEY = 'ihui-business-card-data' as const
export const TOKEN_BALANCE_DATA_KEY = 'ihui-token-balance-data' as const
export const VIP_ORDERS_KEY = 'ihui-vip-orders' as const
export const VIP_PAID_STATUS_KEY = 'ihui-paid-status' as const
export const SSO_CODE_LEGACY_KEY = 'ihui_sso_code' as const
export const WEBVIEW_FILE_CACHE_KEY = 'webviewFileCache' as const

/**
 * 清理缓存时保留的 key(不可清除)
 * 用于 setting/cache 页面"清除全部"场景,保留登录态 + 用户偏好
 */
export const KEEP_KEYS_ON_CLEAR: readonly string[] = [
  TOKEN_STORAGE_KEY, // 'ihui_token'
  REFRESH_TOKEN_STORAGE_KEY, // 'ihui_refresh_token'
  USER_INFO_LEGACY_KEY, // 'ihui_user_info'
  LOCALE_KEY, // 'lang'
  THEME_KEY, // 'theme'
] as const

/**
 * 可清除的 key 分组(按类型)
 * 用于 setting/cache 页面分类清理(图片 / 文件)
 */
export const CLEARABLE_KEY_GROUPS = {
  IMAGE: [IMAGE_HISTORY_KEY, IMAGE_FAVORITES_KEY],
  FILE: [VIDEO_HISTORY_KEY, SSO_CODE_LEGACY_KEY],
} as const
