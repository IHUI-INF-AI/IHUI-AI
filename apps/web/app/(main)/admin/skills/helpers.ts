import { fetchApi } from '@/lib/api'
import type { Skill, SkillForm, MarketListResponse } from './types'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export async function fetchSkills(): Promise<Skill[]> {
  const data = await api<{ skills: Skill[] }>('/api/skills')
  return data?.skills ?? []
}

export async function searchMarketSkills(
  q: string,
  tag: string,
  page: number,
  pageSize: number,
): Promise<MarketListResponse> {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (tag) params.set('tag', tag)
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  const data = await api<MarketListResponse>(`/api/skills/market?${params.toString()}`)
  return data
}

export const EMPTY_FORM: SkillForm = {
  name: '',
  description: '',
  version: '1.0.0',
  tags: '',
  metadata: '',
}

export function skillToForm(item: Skill): SkillForm {
  return {
    name: item.name,
    description: item.description ?? '',
    version: item.version ?? '1.0.0',
    tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
    metadata: item.metadata ? JSON.stringify(item.metadata, null, 2) : '',
  }
}