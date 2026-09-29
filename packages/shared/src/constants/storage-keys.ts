// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端共享 storage key 常量
 * 命名规范:
 * - TOKEN/REFRESH_TOKEN 用下划线前缀(历史遗留,向后兼容,已在各端使用)
 * - 其他 key 用连字符前缀(新规范,与 theme.ts 一致)
 * 各端禁止本地硬编码 storage key 字符串,必须 import 本文件常量
 */

// 历史遗留:下划线前缀(已在各端使用,保持向后兼容)
// 直接定义,避免通过 '../constants' 形成循环依赖:
// constants.ts -> constants/index.ts -> constants/storage-keys.ts -> constants.ts
export const TOKEN_STORAGE_KEY = 'ihui_token'
export const REFRESH_TOKEN_STORAGE_KEY = 'ihui_refresh_token'

// theme.ts 已定义,这里 re-export 避免重复
export { THEME_STORAGE_KEY, LOCALE_STORAGE_KEY } from './theme'

// 新规范:连字符前缀(与 theme.ts 一致)
export const USER_INFO_STORAGE_KEY = 'ihui-user-info' as const

/**
 * 「记住登录」三件的 storage key(2026-09-29 由三端本地字面量提升)。
 *
 * 名字**跨端同值**(RN AsyncStorage / web localStorage / Taro storage 用同一串),
 * 但各自落在自己的沙箱里,数据不互通。值本身:
 * - `REMEMBERED_ACCOUNT_STORAGE_KEY`:**只可能含账号**(判据 = `@ihui/shared/auth/remembered-account`)。
 *   键名沿用历史 `ihui-remember-credentials` 是为了让存量记录被读到并**就地抹掉口令**,
 *   不是"这一档还存口令"—— 改名等于放弃迁移:旧记录会在没人读的时刻自然腐烂,口令留在盘上。
 * - `AUTO_LOGIN_STORAGE_KEY`:布尔事实('1' / '0'),不是凭据。
 * - `LOGIN_HISTORY_STORAGE_KEY`:账号列表,不含口令。
 */
export const REMEMBERED_ACCOUNT_STORAGE_KEY = 'ihui-remember-credentials' as const
export const AUTO_LOGIN_STORAGE_KEY = 'ihui-auto-login' as const
export const LOGIN_HISTORY_STORAGE_KEY = 'ihui-login-history' as const
/** 账号历史上限(超出丢最旧)。 */
export const LOGIN_HISTORY_MAX = 5 as const
export const VIP_STORAGE_KEY = 'ihui-vip-info' as const
export const INVITE_CODE_STORAGE_KEY = 'ihui-invite-code' as const
export const SSO_CODE_STORAGE_KEY = 'ihui-sso-code' as const
export const SSO_USER_STORAGE_KEY = 'ihui-sso-user' as const
export const COZE_CONFIG_STORAGE_KEY = 'coze-config-v1' as const

// extension 专用 storage key / alarm name(从 apps/extension/lib/config.ts 下沉)
export const EXPIRES_IN_STORAGE_KEY = 'ihui_token_expires_in' as const
export const REFRESH_ALARM_NAME = 'ihui-refresh-token' as const
export const API_BASE_URL_STORAGE_KEY = 'ihui_api_base_url' as const
export const PENDING_ROUTE_STORAGE_KEY = 'ihui_pending_route' as const

// web 工作展示区(D50②,2026-09-25 自 apps/web/src/stores/work-panel.ts 端内字面量提升)
// 全局桶与按会话分桶的 tab 快照同键存储(conversationTabs 字段),不新增第二条 key
export const WORK_PANEL_STORAGE_KEY = 'ihui-work-panel' as const
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
