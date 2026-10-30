// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 媒体任务端点(补 RN 承载用,2026-10-27 后端契约现读)
 *
 * 真实实现在 ai-service(prefix `/api`,apps/ai-service/app/main.py:1072-1074 注册):
 *  - GET    /api/media/tasks?kind&status&limit&offset (routers/media_tasks.py:184-205)
 *  - GET    /api/media/tasks/stats                    (media_tasks.py:208-223)
 *  - DELETE /api/media/tasks?kind&status&before       (media_tasks.py:286-307)
 *  - DELETE /api/media/tasks/{task_id}                (media_tasks.py:310-332)
 *  - POST   /api/media/tasks/{task_id}/cancel         (media_tasks.py:335-397)
 *  - POST   /api/media/tasks/cancel                   (media_tasks.py:400-429)
 *  信封统一 `{ok:true,data:...}`(media_tasks.py:205/223/307/332/397/429),
 *  fetchApi 对无 `code` 的裸 JSON 整包视作 data(packages/api-client/src/client.ts:807-815),
 *  故下列函数按 `{ok,data}` 再解一层。
 *
 * ⚠ 承载前置条件(集成方必读):`apps/api` **没有** /api/media/* 代理,
 * apps/web 是靠在 next.config 里把 /api/media/:path* 直连 ai-service 8803 才通的
 * (apps/web/next.config.mjs:704-708);RN 的 base 是 apps/api(8802,
 * apps/mobile-rn/src/lib/config.ts:42-49)。因此在 apps/api 补代理前,
 * 本文件的请求在 RN 端会 404 —— 见 manifest notLanded。
 *
 * 列表项形状 = media_tasks 表行(services/media_tasks.py:219-221 选列),
 * result 由 JSON 字符串解出(services/media_tasks.py:231-238)。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

export interface MediaTaskResultUrls {
  image_url?: string | null
  audio_url?: string | null
  video_url?: string | null
}

export interface MediaTaskItem {
  id: number
  /** video / music / tts / image(services/media_tasks.py:249) */
  kind: string
  tool: string
  provider: string
  /** 上游任务 id(取消/删除按它定位;为空表示未提交到 provider) */
  task_id: string
  user_uuid?: string | null
  /** 发起任务的会话 id,空串 = 无来源会话 */
  chat_id?: string | null
  /** accepted / submitted / pending / processing / succeeded / failed / cancelled */
  status: string
  message: string
  result: MediaTaskResultUrls | null
  created_at: string
  updated_at: string
}

export interface MediaTaskListResult {
  items: MediaTaskItem[]
  total: number
  limit: number
  offset: number
}

export interface MediaTaskKindStats {
  total: number
  succeeded: number
  failed: number
  cancelled: number
  inflight: number
}

export interface MediaTaskStats {
  by_kind: Record<string, MediaTaskKindStats>
  total: number
  inflight: number
  succeeded: number
  failed: number
  cancelled: number
}

export interface MediaTaskClearResult {
  deleted: number
  kept_in_flight: number
}

export interface MediaTaskCancelAllResult {
  requested: number
  cancelled: number
  remote_failed: { task_id: string; error: string }[]
}

/** 单条取消的回执(media_tasks.py:360-397) */
export interface MediaTaskCancelResult {
  provider: string
  task_id: string
  /** 远端取消失败时的原因;有值代表「仅本地置 cancelled」 */
  error?: string
}

type OkEnvelope<T> = { ok?: boolean; data?: T; detail?: string; error?: string }

/** ai-service 的 {ok,data} 裸包:成功取 data,失败转 ApiResult 失败分支。 */
async function fetchOk<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetchApi<unknown>(url, init)
  if (!res.success) return res
  const raw = res.data
  if (raw !== null && typeof raw === 'object' && 'ok' in (raw as Record<string, unknown>)) {
    const env = raw as OkEnvelope<T>
    if (env.ok === false) {
      return { success: false, error: env.detail || env.error || '请求失败' }
    }
    if (env.data === undefined) return { success: false, error: '响应缺少 data' }
    return { success: true, data: env.data }
  }
  return { success: true, data: raw as T }
}

export interface MediaTaskQuery {
  limit?: number
  offset?: number
  /** 逗号分隔多值(如 'processing,accepted,submitted,pending') */
  status?: string
  /** video / music / tts / image,同样支持逗号分隔 */
  kind?: string
}

/** GET /api/media/tasks —— web 用 limit=PAGE_SIZE(10) + offset 翻页(page.tsx:73-85) */
export async function listMediaTasks(
  query: MediaTaskQuery = {},
): Promise<ApiResult<MediaTaskListResult>> {
  return fetchOk<MediaTaskListResult>(`/api/media/tasks${buildQs(query)}`)
}

/** GET /api/media/tasks/stats —— 顶部五卡 + 按 kind 明细(page.tsx:88-96) */
export async function getMediaTaskStats(): Promise<ApiResult<MediaTaskStats>> {
  return fetchOk<MediaTaskStats>('/api/media/tasks/stats')
}

/** POST /api/media/tasks/{task_id}/cancel —— 仅可取消在途,终态返回 409 */
export async function cancelMediaTask(taskId: string): Promise<ApiResult<MediaTaskCancelResult>> {
  return fetchOk<MediaTaskCancelResult>(
    `/api/media/tasks/${encodeURIComponent(taskId)}/cancel`,
    { method: 'POST', body: JSON.stringify({}) },
  )
}

/** DELETE /api/media/tasks/{task_id} —— 只删本地记录 */
export async function deleteMediaTask(
  taskId: string,
): Promise<ApiResult<{ task_id: string; deleted: boolean }>> {
  return fetchOk<{ task_id: string; deleted: boolean }>(
    `/api/media/tasks/${encodeURIComponent(taskId)}`,
    { method: 'DELETE' },
  )
}

/** DELETE /api/media/tasks?status=... —— 清理终态记录,在途一律保留 */
export async function clearMediaTasks(query: {
  status?: string
  kind?: string
  before?: string
} = {}): Promise<ApiResult<MediaTaskClearResult>> {
  return fetchOk<MediaTaskClearResult>(`/api/media/tasks${buildQs(query)}`, { method: 'DELETE' })
}

/** POST /api/media/tasks/cancel —— 批量取消全部在途(web page.tsx:166-200) */
export async function cancelAllMediaTasks(
  body: { task_ids?: string[]; kind?: string } = {},
): Promise<ApiResult<MediaTaskCancelAllResult>> {
  return fetchOk<MediaTaskCancelAllResult>('/api/media/tasks/cancel', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
