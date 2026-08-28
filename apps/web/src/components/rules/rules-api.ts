import { fetchApi } from '@/lib/api'

async function rulesApi<T>(url: string, options: RequestInit = {}): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export { rulesApi }
