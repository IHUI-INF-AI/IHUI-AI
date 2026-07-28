import { fetchApi } from './api'

/**
 * fetchApi 的 unwrap 包装:成功返回 data,失败抛 Error。
 * 供 web admin 模块的 types.ts 共享,消除 9 处重复定义。
 */
export async function unwrapApi<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
