// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Registry 资源更新中心端点封装(补 RN 承载用,2026-10-27 后端契约现读)
 *
 *  - GET  /api/registry/items?sort&sourceType&page&pageSize
 *    → 信封 success({ items, total, page, pageSize, installedIds })
 *    (apps/api/src/routes/registry-sync.ts:282-296,preHandler requireAuth;查询 schema 见
 *     同文件:83-91 —— sort ∈ latest|hot|best、sourceType ∈ mcp|skill|plugin、
 *     page 默认 1、pageSize 默认 20 上限 100;响应形状 =
 *     packages/types/src/registry.ts:79-87(RegistryItemListResponse))
 *    registrySyncRoutes 挂 prefix /api(apps/api/src/routes/index.ts:1251)。
 *  - POST /api/registry/install  body { sourceType, sourceId, version? }
 *    → success({ success, installed, version, message })
 *    (registry-sync.ts:485-534,checkAuth + 写 user_preferences group='registry_installs';
 *     404 = 资源不存在,响应体见 packages/types/src/registry.ts:209-214)
 *  - web 消费方:apps/web/src/lib/api-registry.ts:31-47 ← apps/web/src/hooks/use-registry.ts:21-49
 *    ← apps/web/app/(main)/registry/page.tsx:46-73。
 *  - 管理面(listSyncLogs / triggerSync / configDrift / workerStats)后端均 preHandler requireAdmin
 *    (registry-sync.ts:316/331/605/677),RN 屏未承载,不在此封装重复暴露。
 *  - 既有 @ihui/api-client 无 registry 域封装(此前 registry 只在 web 侧 lib 内),故新建本文件。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

export type RegistrySourceType = 'mcp' | 'skill' | 'plugin'
export type RegistrySortKey = 'latest' | 'hot' | 'best'

/** 资源条目(packages/types/src/registry.ts:38-63 的 RN 侧最小可用投影) */
export interface RegistryItemRecord {
  id: string
  sourceType: RegistrySourceType
  sourceId: string
  name: string
  description: string | null
  version: string | null
  author: string | null
  categories: string[]
  tags: string[]
  installCount: number
  heatScore: number
  qualityScore: number
  latestSyncedAt: string | null
}

/** GET /api/registry/items 响应体(packages/types/src/registry.ts:79-87) */
export interface RegistryItemsResult {
  items: RegistryItemRecord[]
  total: number
  page: number
  pageSize: number
  /** 当前用户已安装条目 id(后端按 userId 计算,registry-sync.ts:288-290) */
  installedIds: string[]
}

export interface RegistryItemsQuery {
  sort?: RegistrySortKey
  sourceType?: RegistrySourceType
  page?: number
  /** 后端字段名 pageSize(上限 100,registry-sync.ts:90) */
  pageSize?: number
}

/** POST /api/registry/install 响应体(packages/types/src/registry.ts:209-214) */
export interface InstallRegistryItemResult {
  success: boolean
  installed: boolean
  version: string | null
  message: string
}

export interface InstallRegistryItemInput {
  sourceType: RegistrySourceType
  sourceId: string
  version?: string
}

/** GET /api/registry/items */
export async function getRegistryItems(
  query: RegistryItemsQuery = {},
): Promise<ApiResult<RegistryItemsResult>> {
  return fetchApi<RegistryItemsResult>(`/api/registry/items${buildQs(query)}`)
}

/** POST /api/registry/install */
export async function installRegistryItem(
  input: InstallRegistryItemInput,
): Promise<ApiResult<InstallRegistryItemResult>> {
  return fetchApi<InstallRegistryItemResult>('/api/registry/install', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
