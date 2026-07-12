import { fetchApi } from '@/lib/api'
import type { DeveloperLink, DeveloperLinkForm } from './types'

export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: DeveloperLinkForm = {
  developerId: '',
  agentId: '',
  status: true,
}

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'developerId', title: '开发者ID' },
  { key: 'agentId', title: 'AgentID' },
  { key: 'status', title: '状态', formatter: (v: unknown) => (v === 1 ? '启用' : '禁用') },
  { key: 'createdAt', title: '创建时间' },
]

export function developerLinkToForm(item: DeveloperLink): DeveloperLinkForm {
  return {
    developerId: item.developerId,
    agentId: item.agentId,
    status: item.status === 1,
  }
}
