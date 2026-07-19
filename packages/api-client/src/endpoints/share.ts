import { fetchApi } from '../client.js'

/** 分享内容中的混合内容条目 */
export interface ShareListItem {
  type: 'text' | 'image' | 'video' | 'audio'
  content: string
}

/** 分享回答中的视频内容 */
export interface ShareVideo {
  url: string
  cover?: string
  width?: number
  height?: number
}

/** 分享回答中的音频内容 */
export interface ShareAudio {
  url: string
  duration?: number
}

/** 分享回答内容 */
export interface ShareAnswer {
  thinking?: string
  text?: string
  images?: string[]
  video?: ShareVideo
  audio?: ShareAudio
  lists?: ShareListItem[]
}

/** 分享内容完整结构 */
export interface ShareContent {
  code: string
  modelName: string
  modelIcon: string
  question: string
  answer: ShareAnswer
  tokenCost?: number
  createdAt: string
  userAvatar?: string | null
  userName?: string | null
  agentId?: string
  userUuid?: string
  gcType?: string
  content?: string
  /** 内容启用状态(1 启用,0 禁用,-1 软删);后端校验后已过滤 0/-1 */
  status?: number
}

/**
 * 获取分享内容
 * 通过统一 fetchApi 调用 /api/share/content/:code，后端返回 { code: 0, data: ShareContent }
 */
export async function fetchShareContent(code: string): Promise<ShareContent> {
  const res = await fetchApi<ShareContent>(`/api/share/content/${code}`)
  if (!res.success) throw new Error(res.error || '获取分享内容失败')
  return res.data
}
