// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Prompt 注册表端点(2026-11-05 立,门 300 存量裁决 A 类:web / RN 端内直拼 `/api/prompts` 收口)。
 *
 * 后端真值:`apps/ai-service/app/routers/prompts.py`(FastAPI,路径 `/api/prompts`,管理员闸)。
 * 注意:路径里的 `{id}` 是 prompt **name**(字符串),不是数字 id。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

export interface PromptSummary {
  name: string
  description: string | null
  latest_version: number
  updated_at: string
  created_at: string
}

export interface PromptVersion {
  version: number
  content: string
  description: string | null
  created_at: string
}

export interface PromptDetail {
  name: string
  description: string | null
  latest_version: number
  versions: PromptVersion[]
  created_at: string
  updated_at: string
}

export interface PromptContent {
  name: string
  version: number
  content: string
}

export interface CreatePromptInput {
  name: string
  content: string
  description?: string
}

/** POST /api/prompts 的载荷。 */
export interface PromptCreated {
  name: string
  description: string
  latest_version: number
  created_at: string
}

export interface UpdatePromptInput {
  content: string
  description?: string
}

/** PUT /api/prompts/:name 的载荷。 */
export interface PromptUpdated {
  name: string
  latest_version: number
  updated_at: string
}

export interface RollbackPromptInput {
  target_version: number
}

/** POST /api/prompts/:name/rollback 的载荷。 */
export interface PromptRolledBack {
  name: string
  latest_version: number
  rollback_to_version: number
  updated_at: string
}

/** DELETE /api/prompts/:name 的载荷。 */
export interface PromptDeleted {
  deleted: boolean
  name: string
}

/** GET /api/prompts —— 列出所有 prompt 及其版本摘要。 */
export async function listPrompts(): Promise<ApiResult<PromptSummary[]>> {
  return fetchApi<PromptSummary[]>('/api/prompts')
}

/** GET /api/prompts/:id —— prompt 详情(含版本列表)。 */
export async function getPrompt(
  id: string,
  query: Record<string, string | number | undefined | null> = {},
): Promise<ApiResult<PromptDetail>> {
  return fetchApi<PromptDetail>(`/api/prompts/${encodeURIComponent(id)}${buildQs(query)}`)
}

/** POST /api/prompts —— 创建 prompt。 */
export async function createPrompt(input: CreatePromptInput): Promise<ApiResult<PromptCreated>> {
  return fetchApi<PromptCreated>('/api/prompts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** PUT /api/prompts/:id —— 更新 prompt(创建新版本)。 */
export async function updatePrompt(
  id: string,
  input: UpdatePromptInput,
): Promise<ApiResult<PromptUpdated>> {
  return fetchApi<PromptUpdated>(`/api/prompts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** DELETE /api/prompts/:id —— 删除 prompt。 */
export async function deletePrompt(id: string): Promise<ApiResult<PromptDeleted>> {
  return fetchApi<PromptDeleted>(`/api/prompts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** GET /api/prompts/:id/content —— 获取 prompt 内容(可指定版本)。 */
export async function getPromptContent(
  id: string,
  query: { version?: number } = {},
): Promise<ApiResult<PromptContent>> {
  return fetchApi<PromptContent>(
    `/api/prompts/${encodeURIComponent(id)}/content${buildQs(query)}`,
  )
}

/** POST /api/prompts/:id/rollback —— 回滚到指定版本。 */
export async function rollbackPrompt(
  id: string,
  input: RollbackPromptInput,
): Promise<ApiResult<PromptRolledBack>> {
  return fetchApi<PromptRolledBack>(`/api/prompts/${encodeURIComponent(id)}/rollback`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
