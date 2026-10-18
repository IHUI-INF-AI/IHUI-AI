// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 语音笔记(D43/G-51)各端统一入口。
 *
 * 为什么要走 @ihui/api-client 而不是页面里自己 fetch:401→登录弹窗、cookie/续期、
 * timeoutMs 与 `{ code, message, data }` 解包都住在传输层;端内裸 fetch 的那一份
 * "r.data 是什么"的理解,就是后端改形状时没人知道谁断了的那个理解。
 */
import type { ApiResult } from '@ihui/types'
import type {
  CreateVoiceNoteInput,
  UpdateVoiceNoteInput,
  VoiceNoteItem,
  VoiceNoteListQuery,
  VoiceNoteListResult,
  VoiceNotePartition,
} from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

export type {
  CreateVoiceNoteInput,
  UpdateVoiceNoteInput,
  VoiceNoteItem,
  VoiceNoteListQuery,
  VoiceNoteListResult,
  VoiceNotePartition,
}

/** 列表:分页 + 归档分区 + 分组 + 关键词(检索在服务端 SQL 谓词上完成)。 */
export function listVoiceNotes(
  query: VoiceNoteListQuery = {},
): Promise<ApiResult<VoiceNoteListResult>> {
  return fetchApi<VoiceNoteListResult>(`/api/voice-notes${buildQs(query)}`)
}

export function createVoiceNote(input: CreateVoiceNoteInput): Promise<ApiResult<VoiceNoteItem>> {
  return fetchApi<VoiceNoteItem>('/api/voice-notes', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateVoiceNote(
  id: string,
  patch: UpdateVoiceNoteInput,
): Promise<ApiResult<VoiceNoteItem>> {
  return fetchApi<VoiceNoteItem>(`/api/voice-notes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

/** 归档 = 写时刻可撤销;archived=false 即恢复回活跃分区。 */
export function setVoiceNoteArchived(
  id: string,
  archived: boolean,
): Promise<ApiResult<VoiceNoteItem>> {
  return fetchApi<VoiceNoteItem>(`/api/voice-notes/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
    body: JSON.stringify({ archived }),
  })
}

export function deleteVoiceNote(id: string): Promise<ApiResult<{ id: string; deleted: boolean }>> {
  return fetchApi<{ id: string; deleted: boolean }>(`/api/voice-notes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
