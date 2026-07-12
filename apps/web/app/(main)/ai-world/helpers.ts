import { fetchApi } from '@/lib/api'
import type { AiWorldData } from './types'

export async function fetchAiWorld(): Promise<AiWorldData> {
  const res = await fetchApi<AiWorldData>('/api/ai-world')
  if (!res.success) throw new Error(res.error)
  return res.data
}
