/**
 * ProfileScreen 4 Tab 内容体系类型定义 + 空数据占位。
 *
 * 1:1 对齐历史 Uniapp user/index.vue(行 318-372 data 定义):
 * - tabList: 文本/图片/视频/音频 4 Tab
 * - 4 个内容列表(文本/图片/视频/音频),每个独立分页(pageNum/pageSize=10/hasMore/loading)
 * - 数据加载由 ProfileScreen.tsx 内 loadTabContent 接 listConversations API 实现
 *
 * 类型零 any(AGENTS.md §3),精确标注。ConversationDetail.metadata 是 unknown,
 * 用 extractConversationMetadata 安全类型守卫提取分类与媒体字段(后端未返回则 fallback 到 text tab)。
 */
import type { ConversationDetail } from '@ihui/api-client'

/** Tab 标识(1=文本, 2=图片, 3=视频, 4=音频,对齐 Uniapp tabList id) */
export type ProfileTabId = 1 | 2 | 3 | 4

export interface ProfileTabItem {
  id: ProfileTabId
  name: string
}

/** 4 Tab 清单(对齐 Uniapp tabList,行 318-323) */
export const PROFILE_TAB_LIST: readonly ProfileTabItem[] = [
  { id: 1, name: '文本' },
  { id: 2, name: '图片' },
  { id: 3, name: '视频' },
  { id: 4, name: '音频' },
]

/** 文本内容(对齐 Uniapp textContentList 项) */
export interface TextContent {
  id: string
  title: string
  time: string
  content: string
}

/** 图片内容(对齐 Uniapp imageContentList 项) */
export interface ImageContent {
  id: string
  title: string
  time: string
  imageList: string[]
}

/** 视频内容(对齐 Uniapp videoContentList 项) */
export interface VideoContent {
  id: string
  title: string
  time: string
  videoUrl: string
  posterUrl?: string
  width?: number
  height?: number
}

/** 音频内容(对齐 Uniapp audioContentList 项) */
export interface AudioContent {
  id: string
  title: string
  time: string
  audioUrl: string
}

/** 分页状态(对齐 Uniapp 每个 Tab 的 pageNum/pageSize/hasMore/loading,行 331-347) */
export interface ContentPagination {
  pageNum: number
  pageSize: number
  hasMore: boolean
  loading: boolean
}

/** 创建初始分页状态(pageSize=10,对齐 Uniapp *PageSize=10) */
export function createInitialPagination(): ContentPagination {
  return { pageNum: 1, pageSize: 10, hasMore: true, loading: false }
}

/**
 * ConversationDetail.metadata 的安全类型守卫形态。
 * 后端在对话元数据中可选写入 contentType / 媒体 URL / 尺寸等字段。
 * 若后端未返回,所有字段保持 undefined,ProfileScreen 走 text tab fallback。
 */
export interface ConversationMetadataShape {
  contentType?: 'text' | 'image' | 'video' | 'audio'
  /** 图片缩略图 URL(也作为单图 imageList 兜底) */
  thumbnailUrl?: string
  /** 视频播放地址 */
  videoUrl?: string
  /** 音频播放地址 */
  audioUrl?: string
  /** 音频时长(秒) */
  audioDuration?: number
  /** 视频封面图 */
  posterUrl?: string
  /** 图片列表(多图) */
  imageList?: string[]
  /** 视频/图片原始宽度 */
  width?: number
  /** 视频/图片原始高度 */
  height?: number
  /** 最后一条消息文本(用于 text tab 显示对话预览) */
  lastMessage?: string
}

/**
 * 从 ConversationDetail.metadata(unknown)安全提取 ConversationMetadataShape。
 * 严格校验每个字段类型,不通过则保持 undefined(类型守卫,零 type assertion 兜底)。
 */
export function extractConversationMetadata(conv: ConversationDetail): ConversationMetadataShape {
  const m = conv.metadata
  if (typeof m !== 'object' || m === null) return {}
  const obj = m as Record<string, unknown>
  const result: ConversationMetadataShape = {}

  // contentType:必须为 'text' | 'image' | 'video' | 'audio' 之一
  if (typeof obj.contentType === 'string') {
    const ct = obj.contentType
    if (ct === 'text' || ct === 'image' || ct === 'video' || ct === 'audio') {
      result.contentType = ct
    }
  }

  // 字符串字段
  if (typeof obj.thumbnailUrl === 'string') result.thumbnailUrl = obj.thumbnailUrl
  if (typeof obj.videoUrl === 'string') result.videoUrl = obj.videoUrl
  if (typeof obj.audioUrl === 'string') result.audioUrl = obj.audioUrl
  if (typeof obj.posterUrl === 'string') result.posterUrl = obj.posterUrl
  if (typeof obj.lastMessage === 'string') result.lastMessage = obj.lastMessage

  // 数值字段
  if (typeof obj.audioDuration === 'number' && Number.isFinite(obj.audioDuration)) {
    result.audioDuration = obj.audioDuration
  }
  if (typeof obj.width === 'number' && Number.isFinite(obj.width)) result.width = obj.width
  if (typeof obj.height === 'number' && Number.isFinite(obj.height)) result.height = obj.height

  // imageList:必须为字符串数组
  if (Array.isArray(obj.imageList) && obj.imageList.every((x) => typeof x === 'string')) {
    result.imageList = obj.imageList as string[]
  }

  return result
}

/** 空数据占位(初始/加载失败时显示) */
export const EMPTY_TEXT_LIST: readonly TextContent[] = []
export const EMPTY_IMAGE_LIST: readonly ImageContent[] = []
export const EMPTY_VIDEO_LIST: readonly VideoContent[] = []
export const EMPTY_AUDIO_LIST: readonly AudioContent[] = []
