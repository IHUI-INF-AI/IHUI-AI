import Taro from '@tarojs/taro'
import { getStorageSync } from '@tarojs/taro'
import { SHARE_PARAM } from '@ihui/shared/constants'
import { USER_INFO_LEGACY_KEY } from '@/constants/storage'

export interface ShareInfo {
  title: string
  path: string
  imageUrl?: string
}

export interface TimelineShareInfo {
  title: string
  query: string
  imageUrl?: string
}

// 2026-07-28 Q-2: 跨端共享的 URL 参数(source/sourceValue/inviteCodeParam)
// 改用 @ihui/shared/constants SHARE_PARAM,消除本地重复定义。
// 保留 defaultTitle/defaultImageUrl/fallbackPath(端独占配置)。
export const shareConfig = {
  defaultTitle: '智汇AI',
  defaultImageUrl: '/static/share.png',
  fallbackPath: '/pages/index/index',
}

export function getInviteCode(): string {
  // 2026-07-28 Q-4: 用 USER_INFO_LEGACY_KEY 常量替代硬编码 'ihui_user_info'
  const userData = getStorageSync(USER_INFO_LEGACY_KEY) || {}
  return (userData as { inviteCode?: string }).inviteCode || ''
}

export function getSharePath(currentPath?: string): string {
  const path = currentPath || shareConfig.fallbackPath
  const inviteCode = getInviteCode()
  const query = `${SHARE_PARAM.SOURCE_PARAM}=${SHARE_PARAM.SOURCE_VALUE}&${SHARE_PARAM.INVITE_CODE_PARAM}=${inviteCode}`
  return path.includes('?') ? `${path}&${query}` : `${path}?${query}`
}

export function getShareInfo(currentPath?: string, title?: string, imageUrl?: string): ShareInfo {
  return {
    title: title || shareConfig.defaultTitle,
    path: getSharePath(currentPath),
    imageUrl: imageUrl || shareConfig.defaultImageUrl,
  }
}

export function getTimelineShareInfo(title?: string, imageUrl?: string): TimelineShareInfo {
  const inviteCode = getInviteCode()
  return {
    title: title || shareConfig.defaultTitle,
    query: `${SHARE_PARAM.SOURCE_PARAM}=${SHARE_PARAM.SOURCE_VALUE}&${SHARE_PARAM.INVITE_CODE_PARAM}=${inviteCode}`,
    imageUrl: imageUrl || shareConfig.defaultImageUrl,
  }
}

export function showShareMenu(
  withShareTicket = true,
  showShareItems: string[] = ['shareAppMessage', 'shareTimeline'],
): void {
  // fail 静默:小程序后台未开通分享权限 / 个人主体 appId 时会报
  // "showShareMenu:fail no permission"(2026-07-26 真实事故 wx27028e276ffdbc5d)
  // 此处不阻塞启动流程,只静默忽略
  Taro.showShareMenu({
    withShareTicket,
    showShareItems,
    fail: () => {},
  })
}

export function hideShareMenu(): void {
  Taro.hideShareMenu()
}

export function onShareSuccess(): void {
  Taro.showToast({ title: '分享成功', icon: 'success', duration: 2000 })
}
