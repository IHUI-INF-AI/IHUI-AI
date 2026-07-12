import Taro from '@tarojs/taro'
import { getStorageSync } from '@tarojs/taro'

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

export const shareConfig = {
  defaultTitle: '智汇AI',
  defaultImageUrl: '/static/share.png',
  fallbackPath: '/pages/index/index',
  sourceParam: 'source',
  sourceValue: 'share',
  inviteCodeParam: 'inviteCode',
}

export function getInviteCode(): string {
  const userData = getStorageSync('ihui_user_info') || {}
  return (userData as { inviteCode?: string }).inviteCode || ''
}

export function getSharePath(currentPath?: string): string {
  const path = currentPath || shareConfig.fallbackPath
  const inviteCode = getInviteCode()
  const query = `${shareConfig.sourceParam}=${shareConfig.sourceValue}&${shareConfig.inviteCodeParam}=${inviteCode}`
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
    query: `${shareConfig.sourceParam}=${shareConfig.sourceValue}&${shareConfig.inviteCodeParam}=${inviteCode}`,
    imageUrl: imageUrl || shareConfig.defaultImageUrl,
  }
}

export function showShareMenu(
  withShareTicket = true,
  showShareItems: string[] = ['shareAppMessage', 'shareTimeline'],
): void {
  Taro.showShareMenu({
    withShareTicket,
    showShareItems,
  })
}

export function hideShareMenu(): void {
  Taro.hideShareMenu()
}

export function onShareSuccess(): void {
  Taro.showToast({ title: '分享成功', icon: 'success', duration: 2000 })
}
