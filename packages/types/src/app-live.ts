// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * packages/types/src/app.ts 的业务域拆分产物之一 —— 本文件承载「live」域。
 *
 * 拆分原因:原 app.ts 单文件行数已超架构契约表对受管模块的单文件上限(config/architecture-policy.yaml
 * 的 contract-file-lines / C1),按业务域拆多入口是既定出路(EX-C2-1 的理由原文即此)。
 * 公开导出面由 ./app.ts 这个 barrel 用 export * 原样递出,与拆分前逐名等值 —— 消费端不得因此改动。
 * 要加类型请加到对应域文件;不要让类型回到 app.ts(app.ts 只允许再导出)。
 */

import type { TFunction } from './app-shared.js'


/** 直播回放列表项(平台注入,字段对齐 mobile-rn LivePlaybackListScreen Item) */
export interface LivePlaybackItem {
  id: string
  title: string
  lecturer: string
  /** 时长(秒) */
  duration: number
  viewerCount: number
  createdAt: string
}

/** LivePlaybackList 屏 props */
export interface LivePlaybackListScreenProps {
  t: TFunction
  items: LivePlaybackItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击回放卡片回调,平台注入导航跳转 */
  onPressItem: (item: LivePlaybackItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 12(2026-07-29):直播列表/优惠券/关注/排行榜/积分商城/考试/VIP */

/** 直播状态 */
export type LiveStatus = 'upcoming' | 'ongoing' | 'ended' | string

/** 直播列表项(平台注入,字段对齐 mobile-rn LiveListScreen LiveItem) */
export interface LiveListItem {
  id: string
  title: string
  lecturer: string
  status: LiveStatus
  startAt: string
  viewerCount: number
  cover: string | null
}

/** 直播列表 tab key */
export type LiveListTab = 'all' | 'upcoming' | 'ongoing' | 'ended' | string

/** LiveListScreen props */
export interface LiveListScreenProps {
  t: TFunction
  items: LiveListItem[]
  activeTab: LiveListTab
  onSelectTab: (tab: LiveListTab) => void
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onPressItem: (item: LiveListItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 直播列表项(平台注入,字段对齐 mobile-rn LiveScreen Live) */
export interface LiveScreenItem {
  id: string
  title: string
  lecturerName?: string
  isLive: boolean
  startTime: string
  viewCount: number
}

/** LiveScreen props(简化版直播列表,无 tab 切换) */
export interface LiveScreenProps {
  t: TFunction
  items: LiveScreenItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onPressItem: (id: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 17(2026-07-29):直播详情/主播端/预告/回放(单条直播深 4 屏) */

/** LiveDetail 聊天连接状态(对齐 mobile-rn LiveChatClient ChatStatus) */
export type LiveDetailChatStatus =
  'idle' | 'connecting' | 'open' | 'reconnecting' | 'error' | 'closed'

/** LiveDetail 聊天消息(对齐 mobile-rn LiveChatClient ChatMessage) */
export interface LiveDetailChatMessage {
  id: string
  nickname: string
  content: string
  /** 已格式化的时间文本(平台注入,避免共享层依赖日期工具) */
  createdAt: string
}

/** LiveDetail 直播详情(平台注入,字段对齐 @ihui/api-client Live 子集) */
export interface LiveDetailItem {
  id: string
  title: string
  isLive: boolean
  lecturerName?: string
  viewCount: number
  playUrl?: string | null
  intro?: string | null
}

/** LiveDetailScreen props(注入式:wrapper 保留 WebSocket/API 调用) */
export interface LiveDetailScreenProps {
  t: TFunction
  live: LiveDetailItem | null
  loading: boolean
  error: string
  subscribed: boolean
  subscribing: boolean
  messages: LiveDetailChatMessage[]
  input: string
  chatStatus: LiveDetailChatStatus
  chatError: string
  onInputChange: (text: string) => void
  onSend: () => void
  onSubscribe: () => void
  /** 直播互动入口按钮(可选):渲染「互动」按钮,点击跳转直播聊天屏 */
  onOpenChat?: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** LiveHost 推流状态(对齐 mobile-rn LiveHostScreen StreamStatus) */
export type LiveHostStatus = 'idle' | 'active' | 'inactive'

/** LiveHost 推流数据(平台注入,字段对齐 SRS API StreamData) */
export interface LiveHostStreamData {
  id: string
  streamKey: string
  title: string
  pushUrl: string | null
  recvBytes: number | null
  sendBytes: number | null
}

/** LiveHost 商品(平台注入,字段对齐 mobile-rn LiveHostScreen Product) */
export interface LiveHostProduct {
  id: string
  name: string
  price: number
}

/** LiveHostScreen props(注入式:wrapper 保留推流/SRS API 调用) */
export interface LiveHostScreenProps {
  t: TFunction
  status: LiveHostStatus
  streamTitle: string
  onStreamTitleChange: (text: string) => void
  stream: LiveHostStreamData | null
  /** 观众数(平台注入,共享层不维护定时器) */
  viewers: number
  /** 已格式化的时长文本(平台注入) */
  durationText: string
  /** 已格式化的字节文本(平台注入,recvBytes) */
  recvBytesText: string
  /** 已格式化的字节文本(平台注入,sendBytes) */
  sendBytesText: string
  loading: boolean
  error: string
  products: LiveHostProduct[]
  productsLoading: boolean
  productsError: string
  onStartLive: () => void
  onEndLive: () => void
  onAddProduct: () => void
  onCopyText: (text: string, label: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** LivePreview 预告详情(平台注入,字段对齐 mobile-rn LivePreviewScreen Detail) */
export interface LivePreviewItem {
  id: string
  title: string
  lecturer: string
  startAt: string
  intro: string
  subscribed: boolean
}

/** LivePreviewScreen props */
export interface LivePreviewScreenProps {
  t: TFunction
  item: LivePreviewItem | null
  loading: boolean
  error: string
  subscribing: boolean
  onSubscribe: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** LivePlayback 列表项(平台注入,字段对齐 @ihui/api-client Live 子集) */
export interface LivePlaybackScreenItem {
  id: string
  title: string
  lecturerName?: string
  /** 已格式化的开始时间文本(平台注入) */
  startTimeText: string
  /** 已格式化的时长文本(平台注入) */
  durationText: string
  viewCount: number
  playUrl?: string | null
}

/** LivePlaybackScreen props */
export interface LivePlaybackScreenProps {
  t: TFunction
  items: LivePlaybackScreenItem[]
  loading: boolean
  refreshing: boolean
  error: string
  /** 当前播放的回放(平台注入,控制 Modal 显隐) */
  activeItem: LivePlaybackScreenItem | null
  /** 用户昵称(平台注入,header 展示) */
  userName: string
  onRefresh: () => void
  onPressItem: (item: LivePlaybackScreenItem) => void
  onClosePlayer: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
