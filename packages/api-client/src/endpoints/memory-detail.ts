// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 记忆详情端点(补 RN 承载 web /memory/[id] 用,2026-10-27 后端契约现读)。
 *
 * 为什么另立一件:既有 packages/api-client/src/endpoints/memory.ts 是 UnifiedMemoryClient
 * 的自托管用途(显式要传 apiBaseUrl + userId,走 X-User-Id 语义),与 web 页
 * (`apps/web/src/lib/memory-api.ts`)经 Bearer 调 /api/memory 是两套入口,不可互相顶替。
 *
 * 后端契约(apps/api/src/routes/memory.ts,经 apps/api/src/routes/index.ts:985 以 prefix /api 注册):
 *  - GET /api/memory?scope=&sessionId=&projectKey=
 *    → success({ entries, total })(apps/api/src/routes/memory.ts:158-182);
 *    鉴权 checkAuthOrInternalService(:159);无 scope 时聚合全部 scope(:173-179)。
 *  - POST /api/memory body=MemoryCreateInput
 *    → 201 success(MemoryEntry)(apps/api/src/routes/memory.ts:185-213)。
 *  - DELETE /api/memory/:id?scope=&sessionId=&projectKey=
 *    → success({ id, deleted })(apps/api/src/routes/memory.ts:216-241);
 *    未命中返回 404「记忆条目不存在」(:240)。
 *
 * 后端**没有** GET /api/memory/:id —— 详情页与 web 同口径:先拉列表再按 id 命中
 * (apps/web/app/(main)/memory/[id]/PageClient.tsx:47-56)。
 */
import type {
  ApiResult,
  MemoryCreateInput,
  MemoryDeleteResponse,
  MemoryEntry,
  MemoryListQuery,
  MemoryListResponse,
} from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

/** GET /api/memory —— 当前用户的记忆列表(不传 scope 即聚合全部作用域) */
export async function getMemoryEntries(
  query: MemoryListQuery = {},
): Promise<ApiResult<MemoryListResponse>> {
  return fetchApi<MemoryListResponse>(`/api/memory${buildQs(query)}`)
}

/** POST /api/memory —— 写入一条记忆(后端生成 id/createdAt/updatedAt) */
export async function createMemoryEntry(
  input: MemoryCreateInput,
): Promise<ApiResult<MemoryEntry>> {
  return fetchApi<MemoryEntry>('/api/memory', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** DELETE /api/memory/:id —— 删除指定记忆条目 */
export async function deleteMemoryEntry(
  id: string,
  query: MemoryListQuery = {},
): Promise<ApiResult<MemoryDeleteResponse>> {
  return fetchApi<MemoryDeleteResponse>(
    `/api/memory/${encodeURIComponent(id)}${buildQs(query)}`,
    { method: 'DELETE' },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
