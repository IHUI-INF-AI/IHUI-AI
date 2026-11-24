// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话内快捷笔记(D43/G-51)的跨端唯一类型源。
 *
 * 为什么在 @ihui/types 而不是组件里:同一份形状要经 api → web/extension/RN 三侧读,
 * 每侧各写一份接口就各有一份"r.data 是什么"的理解 —— 后端改形状时没人知道谁断了。
 * 归档分区与 notifications 的 D195 契约同口径:null = 在活跃流里,有值 = 已归档且记下收走时刻
 * (归档是可撤销状态,不是删除的副产品)。
 */

export type VoiceNotePartition = 'active' | 'archived'

/** 服务端回给各端的笔记行(字段名与 chat_voice_notes 的驼峰映射一致)。 */
export interface VoiceNoteItem {
  id: string
  conversationId: string | null
  title: string
  /** 转写正文;仅存音频或转写未达为 null */
  transcript: string | null
  durationMs: number
  audioUrl: string | null
  groupKey: string
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

/** 分组计数条目:分组由用户随手命名,无重名约束,故只回 key + 该组条数。 */
export interface VoiceNoteGroupFacet {
  groupKey: string
  count: number
}

export interface VoiceNoteListQuery {
  page?: number
  pageSize?: number
  /** 缺省 active:默认视图混入归档行等于"没归档" */
  partition?: VoiceNotePartition
  groupKey?: string
  /** 关键词:服务端在 title/transcript 上走 SQL 谓词,不得前端拉全桶再 filter */
  q?: string
  conversationId?: string
  /** 带上分组计数(面板顶上的分组档要用;不要时不传,省一次 groupBy) */
  withGroups?: '1' | 'true'
}

export interface VoiceNoteListResult {
  list: VoiceNoteItem[]
  total: number
  page: number
  pageSize: number
  groups?: VoiceNoteGroupFacet[]
}

export interface CreateVoiceNoteInput {
  title: string
  transcript?: string | null
  durationMs: number
  audioUrl?: string | null
  groupKey?: string
  conversationId?: string | null
}

export interface UpdateVoiceNoteInput {
  title?: string
  groupKey?: string
  transcript?: string | null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
