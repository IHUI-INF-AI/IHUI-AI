/**
 * 跨端分享信息类型(从 apps/miniapp-taro/src/utils/share.ts 下沉)。
 */

/** 分享给朋友(shareAppMessage)的参数 */
export interface ShareInfo {
  title: string
  path: string
  imageUrl?: string
}

/** 分享到朋友圈(shareTimeline)的参数 */
export interface TimelineShareInfo {
  title: string
  query: string
  imageUrl?: string
}
