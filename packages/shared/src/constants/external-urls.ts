/**
 * 跨端共享外部 URL 常量
 * 消除 mobile-rn 和 miniapp-taro 两端 CDN / 头像 fallback URL 硬编码重复
 */
export const DEFAULT_AVATAR_URL = 'https://file.aizhs.top/sys-mini/daixaodiming.png' as const
export const DEFAULT_SHARE_IMAGE_URL = '/static/share.png' as const

// 跨端 web 端基础 URL(已存在的 WEB_BASE 也 re-export 到这里统一管理)
// 注意:如果 packages/shared/src/constants.ts 已定义 WEB_BASE,这里不重复定义,只 re-export
