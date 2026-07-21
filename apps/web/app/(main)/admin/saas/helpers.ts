/**
 * P1-2.2: 租户管理页面 helpers
 */
import { fetchApi } from '@/lib/api'

/** api<T> 包装 — 与 users/helpers.ts 风格一致 */
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data as T
}

/** 共享 Select 样式 */
export const selectClass =
  'h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
