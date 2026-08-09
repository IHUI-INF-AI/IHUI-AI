import { fetchApi } from '@/lib/api'
import type { SkillMarketEntry } from '@ihui/shared/skills/market'

interface SkillEntry {
  name: string
  version: string
  updatedAt: string
  status?: string
}

export async function fetchMarketSkills(): Promise<SkillMarketEntry[]> {
  const res = await fetchApi<{ items: SkillMarketEntry[]; total: number }>(
    '/api/skills/market?page=1&pageSize=100',
  )
  if (!res.success) throw new Error(res.error)
  return res.data.items
}

export async function fetchUserSkills(): Promise<SkillEntry[]> {
  const res = await fetchApi<SkillEntry[]>('/api/skills')
  if (!res.success) throw new Error(res.error)
  return res.data
}

export function classifyTags(tags: string[]): string {
  if (tags.some((t) => /code|script|function|api/i.test(t))) return 'code'
  if (tags.some((t) => /media|image|audio|video/i.test(t))) return 'media'
  return 'ai-top'
}