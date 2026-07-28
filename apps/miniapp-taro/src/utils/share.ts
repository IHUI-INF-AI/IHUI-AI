import Taro from '@tarojs/taro'
import { getStorageSync } from '@tarojs/taro'
import {
  getSharePath as sharedGetSharePath,
  getShareInfo as sharedGetShareInfo,
  getTimelineShareInfo as sharedGetTimelineShareInfo,
  type ShareDefaults,
} from '@ihui/shared/share'
import { USER_INFO_LEGACY_KEY } from '@/constants/storage'
import type { ShareInfo, TimelineShareInfo } from '@ihui/types'

// ShareInfo / TimelineShareInfo 已下沉到 @ihui/types
export type { ShareInfo, TimelineShareInfo } from '@ihui/types'

// 2026-07-28 Q-2: 跨端共享的 URL 参数(source/sourceValue/inviteCodeParam)
// 改用 @ihui/shared/constants SHARE_PARAM,消除本地重复定义。
// 2026-07-28 Q-6: getSharePath/getShareInfo/getTimelineShareInfo 的纯逻辑部分
// 下沉到 @ihui/shared/share,本文件保留端独占的 shareConfig 默认值 + getInviteCode
// (storage 读取) + Taro API 调用(showShareMenu/hideShareMenu)。
export const shareConfig: ShareDefaults = {
  defaultTitle: '智汇AI',
  defaultImageUrl: '/static/share.png',
  fallbackPath: '/pages/index/index',
}

export function getInviteCode(): string {
  // 2026-07-28 Q-4: 用 USER_INFO_LEGACY_KEY 常量替代硬编码 'ihui_user_info'
  const userData = getStorageSync(USER_INFO_LEGACY_KEY) || {}
  return (userData as { inviteCode?: string }).inviteCode || ''
}

/**
 * 构建分享路径(端薄封装):用 shareConfig.fallbackPath 兜底 + 从 storage 读 inviteCode,
 * 调用 @ihui/shared/share 的纯逻辑 getSharePath。
 * 保留原签名 (currentPath?: string) => string,外部调用方 / 测试无需修改。
 */
export function getSharePath(currentPath?: string): string {
  return sharedGetSharePath(currentPath || shareConfig.fallbackPath, getInviteCode())
}

/**
 * 构建好友分享信息对象(端薄封装):注入 shareConfig + inviteCode。
 * 保留原签名 (currentPath?, title?, imageUrl?) => ShareInfo。
 */
export function getShareInfo(currentPath?: string, title?: string, imageUrl?: string): ShareInfo {
  return sharedGetShareInfo({
    defaults: shareConfig,
    path: currentPath,
    title,
    imageUrl,
    inviteCode: getInviteCode(),
  })
}

/**
 * 构建朋友圈分享信息对象(端薄封装):注入 shareConfig + inviteCode。
 * 保留原签名 (title?, imageUrl?) => TimelineShareInfo。
 */
export function getTimelineShareInfo(title?: string, imageUrl?: string): TimelineShareInfo {
  return sharedGetTimelineShareInfo({
    defaults: shareConfig,
    title,
    imageUrl,
    inviteCode: getInviteCode(),
  })
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
  // TODO: i18n — Taro.showToast 硬编码中文待翻译(分享成功)
  Taro.showToast({ title: '分享成功', icon: 'success', duration: 2000 })
}
