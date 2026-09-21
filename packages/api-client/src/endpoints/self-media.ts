// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自媒体助手端点(2026-09-05 新增,M3 web→mobile 对齐)。
 *
 * 数据源:api(8802) /api/self-media/* —— skills/invoke 透明代理 ai-service
 * (FastAPI 裸 JSON,非 success 包装);records 直读 8802 数据库(success 包装)。
 * 调用方需兼容两种响应形态(见 listSelfMediaSkills 的运行时收窄)。
 */

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'

// =============================================================================
// 技能(ai-service 裸 JSON 响应)
// =============================================================================

/** 技能元数据(对齐 ai-service SkillMeta) */
export interface SelfMediaSkill {
  id: string
  name: string
  description: string
  /** 'wechat' | 'koubo' */
  category: string
  directory: string
  /** 目录是否存在(可调用) */
  available: boolean
  /** 可调用的脚本名 */
  entryPoints: string[]
  /** 示例调用提示(供输入框 placeholder) */
  examples: string[]
  tags: string[]
}

/** 技能调用结果(对齐 ai-service InvokeResponse) */
export interface SelfMediaInvokeResult {
  skillId: string
  ok: boolean
  output: string
  duration_ms: number
  error?: string | null
}

/**
 * GET /api/self-media/skills — 技能列表。
 * ai-service 返回裸数组(无 success 包装),运行时按数组/包装体两种形态收窄。
 */
export async function listSelfMediaSkills(): Promise<SelfMediaSkill[]> {
  const res: unknown = await fetchApi<unknown>('/api/self-media/skills')
  if (Array.isArray(res)) return res as SelfMediaSkill[]
  if (res && typeof res === 'object' && 'data' in res) {
    const data = (res as { data?: unknown }).data
    if (Array.isArray(data)) return data as SelfMediaSkill[]
  }
  return []
}

/** POST /api/self-media/skills/:skillId/invoke — 调用技能(prompt ≤8000 字符) */
export async function invokeSelfMediaSkill(
  skillId: string,
  prompt: string,
  context: Record<string, unknown> = {},
): Promise<SelfMediaInvokeResult> {
  const res = await fetchApi<SelfMediaInvokeResult>(
    `/api/self-media/skills/${encodeURIComponent(skillId)}/invoke`,
    { method: 'POST', body: JSON.stringify({ prompt, context }), timeoutMs: 180_000 },
  )
  if (res.success && res.data) return res.data
  return { skillId, ok: false, output: '', duration_ms: 0, error: res.error }
}

// =============================================================================
// 记录(8802 success 包装响应)
// =============================================================================

/** 发布/生成记录(对齐 self_media_published 表) */
export interface SelfMediaRecord {
  id: string
  category: string
  title: string
  status: string
  draftId: string | null
  topicKeyword: string | null
  payload: Record<string, unknown> | null
  createdAt: string
}

/** GET /api/self-media/records — 生成/发布记录(category: wechat|koubo,limit ≤100) */
export async function listSelfMediaRecords(params?: {
  category?: string
  limit?: number
}): Promise<ApiResult<{ items: SelfMediaRecord[]; count: number }>> {
  const qs = new URLSearchParams()
  if (params?.category) qs.append('category', params.category)
  if (params?.limit) qs.append('limit', String(params.limit))
  const query = qs.toString()
  return fetchApi(`/api/self-media/records${query ? `?${query}` : ''}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
