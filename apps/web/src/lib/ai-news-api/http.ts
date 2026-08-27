import { fetchApi } from '../api'

export function safeApi<T>(url: string): Promise<T | null> {
  // server component 中 fetch 相对路径会失败(无 origin),需用绝对 URL
  const isServer = typeof window === 'undefined'
  const baseUrl = isServer ? (process.env.API_URL ?? 'http://localhost:8802') : ''
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`
  return fetchApi<T>(fullUrl)
    .then((r) => (r.success ? r.data : null))
    .catch(() => null)
}
