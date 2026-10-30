// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 智能体「编辑」端点(GET /api/agents/:agentId 已在 endpoints/agent.ts:66 getAgentDetail,
 * 本件只补 web 编辑页实际需要的另外两条,不重复封装):
 *
 *  - PUT /api/agents/:agentId —— 更新智能体(apps/api/src/routes/agents.ts:565-592)
 *    · 路径参数 agentId 先过 uuid 形状闸,畸形回 400(agents.ts:568-569)
 *    · body Zod safeParse 只认 name/description/avatar/cover/categoryId/workspaceId/
 *      status/price/isFree/sort/remark(agents.ts:570-584),成功回 success(agent) 裸行(agents.ts:591)
 *    · 鉴权:agentsRoutes preHandler 对写方法一律 requireAuth(agents.ts:323+ 的 preHandler 段)
 *  - GET /api/categories/list —— 分类下拉(apps/api/src/routes/agents.ts:662-680)
 *    信封 success({ list, total, page, pageSize })(形状=findCategoryList 返回,
 *    web 同形消费见 apps/web/app/(main)/agents/edit/[id]/PageClient.tsx:67)
 *
 * 与 web 编辑页同参同形:apps/web/app/(main)/agents/edit/[id]/PageClient.tsx:61(详情)、
 * :67(分类 page=1&pageSize=100)、:91-94(PUT body 字段集)。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'

/** 分类行 = categories 表直出(GET /api/categories/list → data.list) */
export interface AgentCategoryRow {
  categoryId: string
  name: string
  description: string | null
  icon: string | null
  sort: number
  status: string
  isPaid: boolean
  createdAt: string
}

export interface AgentCategoryQuery {
  page?: number
  pageSize?: number
  status?: string
  isPaid?: boolean
  keyword?: string
}

/** 分类列表(GET /api/categories/list,apps/api/src/routes/agents.ts:662) */
export async function getAgentCategoriesList(
  query: AgentCategoryQuery = {},
): Promise<ApiResult<PageData<AgentCategoryRow>>> {
  return fetchApi<PageData<AgentCategoryRow>>(`/api/categories/list${buildQs(query)}`)
}

/**
 * PUT body 字段集逐字取后端 Zod(agents.ts:570-584):后端未声明的字段不传,
 * 避免"前端以为存了、后端静默丢弃"。
 */
export interface AgentUpdateInput {
  name?: string
  description?: string | null
  avatar?: string | null
  cover?: string | null
  categoryId?: string | null
  workspaceId?: string | null
  status?: string
  price?: number
  isFree?: boolean
  sort?: number
  remark?: string | null
}

/** 更新智能体(PUT /api/agents/:agentId,apps/api/src/routes/agents.ts:565) */
export async function updateAgentProfile(
  agentId: string,
  input: AgentUpdateInput,
): Promise<ApiResult<Record<string, unknown>>> {
  return fetchApi<Record<string, unknown>>(`/api/agents/${encodeURIComponent(agentId)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
