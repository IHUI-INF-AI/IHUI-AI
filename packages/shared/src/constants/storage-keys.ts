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
export const VIP_STORAGE_KEY = 'ihui-vip-info' as const
export const INVITE_CODE_STORAGE_KEY = 'ihui-invite-code' as const
export const SSO_CODE_STORAGE_KEY = 'ihui-sso-code' as const
export const SSO_USER_STORAGE_KEY = 'ihui-sso-user' as const
export const COZE_CONFIG_STORAGE_KEY = 'coze-config-v1' as const
