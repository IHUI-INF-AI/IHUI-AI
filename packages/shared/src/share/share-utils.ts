/**
 * 跨端分享纯逻辑工具(零平台依赖)
 *
 * 消除 miniapp-taro utils/share.ts 中 getSharePath/getShareInfo/getTimelineShareInfo
 * 的纯逻辑部分。各端通过注入 ShareDefaults(端独占配置)和 inviteCode(从 storage 读取)
 * 复用本模块,保留 Taro API 调用(showShareMenu 等)在端内。
 */
import { SHARE_PARAM } from '../constants/share'
import type { ShareInfo, TimelineShareInfo } from '@ihui/types'

/** 端独占的分享默认值配置(各端通过此对象注入 title/imageUrl/fallbackPath) */
export interface ShareDefaults {
  defaultTitle: string
  defaultImageUrl: string
  fallbackPath: string
}

/**
 * 构建分享路径:在 path 上追加 source + inviteCode 参数。
 *
 * 行为(与原 miniapp-taro utils/share.ts 一致):
 * - inviteCode 默认空字符串(仍追加 inviteCodeParam=)
 * - 若 path 已含 '?',追加 '&';否则追加 '?'
 */
export function getSharePath(path: string, inviteCode = ''): string {
  const query = `${SHARE_PARAM.SOURCE_PARAM}=${SHARE_PARAM.SOURCE_VALUE}&${SHARE_PARAM.INVITE_CODE_PARAM}=${inviteCode}`
  return path.includes('?') ? `${path}&${query}` : `${path}?${query}`
}

/**
 * 构建朋友圈分享 query 字符串(独立导出,方便单独复用)。
 */
export function getTimelineQuery(inviteCode = ''): string {
  return `${SHARE_PARAM.SOURCE_PARAM}=${SHARE_PARAM.SOURCE_VALUE}&${SHARE_PARAM.INVITE_CODE_PARAM}=${inviteCode}`
}

/**
 * 构建好友分享信息对象(纯逻辑,无 storage / Taro 依赖)。
 * path 为空时使用 defaults.fallbackPath,title/imageUrl 为空时使用默认值。
 */
export function getShareInfo(opts: {
  defaults: ShareDefaults
  path?: string
  title?: string
  imageUrl?: string
  inviteCode?: string
}): ShareInfo {
  const { defaults, path, title, imageUrl, inviteCode = '' } = opts
  return {
    title: title || defaults.defaultTitle,
    path: getSharePath(path || defaults.fallbackPath, inviteCode),
    imageUrl: imageUrl || defaults.defaultImageUrl,
  }
}

/**
 * 构建朋友圈分享信息对象(纯逻辑,无 storage / Taro 依赖)。
 */
export function getTimelineShareInfo(opts: {
  defaults: ShareDefaults
  title?: string
  imageUrl?: string
  inviteCode?: string
}): TimelineShareInfo {
  const { defaults, title, imageUrl, inviteCode = '' } = opts
  return {
    title: title || defaults.defaultTitle,
    query: getTimelineQuery(inviteCode),
    imageUrl: imageUrl || defaults.defaultImageUrl,
  }
}
