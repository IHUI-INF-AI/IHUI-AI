// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 上下文引擎(Context Engine)端点(2026-09-05 新增,M3 web→mobile 对齐)。
 *
 * 覆盖只读能力:
 * - 压缩统计(GET /compression-stats,ai-service 聚合,5s 超时)
 * - 上下文提及检索(GET /mentions,文件/表/符号/URL 混合搜索)
 * 生成/订阅类端点(visualization/track、enrich、sources PUT)属 Web 编辑场景,移动端不做。
 */

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'

// =============================================================================
// 压缩统计
// =============================================================================

/** 压缩事件(对齐 ai-service /api/context/compression-stats) */
export interface ContextCompressionEvent {
  timestamp: number
  conversation_id: string
  tokens_before: number
  tokens_after: number
  compression_ratio: number
  quality_score: number
  removed_count: number
}

/** 压缩统计(ai-service 不可用时后端返回全零兜底) */
export interface ContextCompressionStats {
  totalEvents: number
  avgCompressionRatio: number
  avgQualityScore: number
  recentEvents: ContextCompressionEvent[]
}

/** GET /api/compression-stats — 上下文压缩统计 */
export async function getContextCompressionStats(): Promise<
  ApiResult<ContextCompressionStats>
> {
  return fetchApi('/api/context/compression-stats')
}

// =============================================================================
// 上下文提及检索
// =============================================================================

/** 提及类型:file | dir | table | symbol | url(web /context 同源) */
export type ContextMentionType = 'file' | 'dir' | 'table' | 'symbol' | 'url'

/** 上下文提及条目(对齐 @ihui/types ContextMention 核心字段) */
export interface ContextMention {
  id: string
  type: ContextMentionType
  /** 显示名(文件名 / 表名 / 符号名) */
  label: string
  /** 副标题(路径 / 列定义摘要 / 符号类型) */
  detail?: string
  /** 插入到输入框的文本 */
  insertText: string
}

/** GET /api/mentions — 提及检索(q 为空时返回最近/常驻条目) */
export async function searchContextMentions(params?: {
  q?: string
  type?: ContextMentionType
  limit?: number
}): Promise<ApiResult<{ mentions: ContextMention[]; total: number }>> {
  return fetchApi('/api/context/mentions', { params })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
