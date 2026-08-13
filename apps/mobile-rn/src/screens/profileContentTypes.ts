/**
 * ProfileScreen 4 Tab 内容体系类型定义 + 空数据占位。
 *
 * 1:1 对齐历史 Uniapp user/index.vue(行 318-372 data 定义):
 * - tabList: 文本/图片/视频/音频 4 Tab
 * - 4 个内容列表(文本/图片/视频/音频),每个独立分页(pageNum/pageSize=10/hasMore/loading)
 * - 数据加载是后续任务,本文件只提供类型 + 空数组占位 + 分页状态工厂
 *
 * 类型零 any(AGENTS.md §3),精确标注。
 */

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
 * 按 Tab 加载内容(空实现占位,对齐 Uniapp loadContentByTab 行 844-858)。
 * 数据加载是后续任务,本任务只做 UI + 类型结构,保留函数签名供后续接入 API。
 */
export function loadContentByTab(_tabId: ProfileTabId, _isLoadMore = false): void {
  // 后续任务在此接入 getMyCreation API(对齐 Uniapp loadTextContent/loadImageContent 等)
}

/** 空数据占位(数据加载是后续任务,本任务只做 UI + 类型结构) */
export const EMPTY_TEXT_LIST: readonly TextContent[] = []
export const EMPTY_IMAGE_LIST: readonly ImageContent[] = []
export const EMPTY_VIDEO_LIST: readonly VideoContent[] = []
export const EMPTY_AUDIO_LIST: readonly AudioContent[] = []
