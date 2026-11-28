// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运营内容工具的 web 端操作面(G-17,2026-11-28):把 @ihui/api-client 的 admin
 * 包装函数适配成共享执行器 AdminContentOps 的注入形态。
 *
 * 鉴权边界:这里发出的每个请求都带**当前登录用户本人**的会话(fetchApi 统一注入),
 * admin 端点的 requireAdmin 按用户真实角色判 —— agent 侧不持有、也不需要任何
 * 服务凭据;非管理员调用会得到 403 并以 tool-result 错误回传给模型。
 */
import type { ApiResult } from '@ihui/types'
import { addCarousel, fetchApi, listCarousel, updateCarousel } from '@ihui/api-client'

export interface AdminContentOpOutcome {
  ok: boolean
  data?: unknown
  message?: string
}

export interface AdminContentOps {
  listAnnouncements(query?: Record<string, unknown>): Promise<AdminContentOpOutcome>
  createAnnouncement(body: Record<string, unknown>): Promise<AdminContentOpOutcome>
  updateAnnouncement(id: string, body: Record<string, unknown>): Promise<AdminContentOpOutcome>
  listCarousels(query?: Record<string, unknown>): Promise<AdminContentOpOutcome>
  createCarousel(body: Record<string, unknown>): Promise<AdminContentOpOutcome>
  updateCarousel(id: string, body: Record<string, unknown>): Promise<AdminContentOpOutcome>
}

function qs(query: Record<string, unknown> = {}): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v != null && v !== '') sp.set(k, String(v))
  const s = sp.toString()
  return s ? `?${s}` : ''
}

async function listAdminAnnouncements(
  query: Record<string, unknown> = {},
): Promise<ApiResult<{ list: unknown[]; total: number }>> {
  return fetchApi<{ list: unknown[]; total: number }>(`/api/admin/content/announcement${qs(query)}`)
}

async function addAnnouncement(
  body: Record<string, unknown>,
): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>('/api/admin/content/announcement', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

async function updateAnnouncement(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>(`/api/admin/content/announcement/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

function toOutcome<T>(res: ApiResult<T>): AdminContentOpOutcome {
  if (res.success) return { ok: true, data: res.data }
  return { ok: false, message: res.error }
}

export function createAdminContentOps(): AdminContentOps {
  return {
    async listAnnouncements(query) {
      return toOutcome(await listAdminAnnouncements(query ?? {}))
    },
    async createAnnouncement(body) {
      return toOutcome(await addAnnouncement(body))
    },
    async updateAnnouncement(id, body) {
      return toOutcome(await updateAnnouncement(id, body))
    },
    async listCarousels(query) {
      return toOutcome(await listCarousel((query ?? {}) as Record<string, string | number | boolean | null | undefined>))
    },
    async createCarousel(body) {
      return toOutcome(await addCarousel(body))
    },
    async updateCarousel(id, body) {
      return toOutcome(await updateCarousel(id, body))
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
