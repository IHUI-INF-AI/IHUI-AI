// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ReactNode } from 'react'

import type { TFunction } from './app-shared.js'
import type { ChatMessage as BaseChatMessage } from './chat.js'

/**
 * 聊天消息视觉结构(块 7)的 props 单一源 —— 自 packages/app/src/features/chat/ChatMessageItem 上移(2026-11-06)。
 *
 * 跨端共享件只画结构,图标/图片源/分享按钮/视频节点等全部由端侧注入;
 * 因此契约里出现的是「注入面」而不是平台 API。
 */

/** 端内 style 采用 rpx/CSS 变量字符串,RN 原语只做透传,不走 RN 数值布局类型 */
export type ChatMessageItemCss = Record<string, string | number | undefined>

/**
 * 消息视觉结构消费的字段集:基础消息 + 各端渲染面共有的媒体/卡片维度。
 * 端侧消息类型(如小程序 `@/api` 的 ChatMessage)结构上都能赋给这里。
 */
export type ChatMessageItemMessage = Omit<BaseChatMessage, 'id' | 'parentMessageId'> & {
  /** 流式行在拿到落库 id 前为空(端内流式消息语义),故不强制必填 */
  id?: string
  /** 端内流式行没有版本族坐标,历史回放行才带;两值可为 null(端内既有口径) */
  parentMessageId?: string | null
  siblingIndex?: number | null
  images?: string[]
  videos?: string[]
  audioUrl?: string
  audioDuration?: number
  tokenCount?: number
  codeContent?: string
  aiCards?: {
    citations?: Array<{ source: string; label: string; url?: string }>
  }
}

/** 端侧矢量图标注入:名字/尺寸/颜色/附加样式由共享层给定,端侧只负责画 */
export type ChatMessageItemRenderIcon = (props: {
  name: string
  size: number
  color: string
  className?: string
  style?: ChatMessageItemCss
  onClick?: () => void
}) => ReactNode

export interface ChatMessageItemViewProps {
  t: TFunction
  msg: ChatMessageItemMessage
  /** 端侧图片源(复用/复制/下载/思考/分享) */
  icons: {
    reuse: string
    copy: string
    download: string
    sikao: string
    share: string
  }
  renderIcon: ChatMessageItemRenderIcon
  /** rpx 换算 helper(端侧注入:H5→vw / 小程序→rpx,共享层不碰平台) */
  rpx: (n: number) => string
  onCopy: (text: string) => void
  onOpenImage: (current: string, list: string[]) => void
  onDownloadImages: (urls: string[]) => void
  onOpenDigitalHuman: () => void
  /** 播放语音;端侧在 ended/error 时调用 onEnded 复位视觉态 */
  onPlayVoice: (url: string, onEnded: () => void) => void
  onRate: (next: 'like' | 'dislike') => void
  onApproval: (actionId: string) => void
  approvalActions?: readonly { id: string; label: string }[]

  onReuse?: (question: string) => void
  onRegenerate?: () => void
  onLongPress?: () => void
  onEdit?: () => void
  isFavorited?: boolean
  onToggleFavorite?: () => void
  onSpeak?: (content: string) => void
  onOpenReasoning?: () => void
  onShare?: () => void

  /** 版本菜单节点(端侧注入;共享层只给挂载位) */
  versionMenuSlot?: ReactNode
  /** 分享按钮节点(小程序需 Button openType=share;共享层只给挂载位) */
  shareSlot?: ReactNode
  /** 视频节点(端侧注入 Video 原语) */
  renderVideo?: (url: string, index: number) => ReactNode
  /** AI 活动卡节点(计划/工具/终端/子任务/注入/引用) */
  activityCardsSlot?: ReactNode
  /** Steer 引导交代卡节点 */
  steerNoticeSlot?: ReactNode
}
