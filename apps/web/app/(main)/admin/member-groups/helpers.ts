import { fetchApi } from '@/lib/api'
import { ApiError } from '@/lib/api-error'
import type { GroupForm, GroupsListData, MemberGroup } from './types'

export const PAGE_SIZE = 10

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const EMPTY_FORM: GroupForm = { name: '', type: 'custom', description: '' }

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new ApiError(r.error, r.status, r.errorCode)
  return r.data
}

export async function fetchGroups(type?: string): Promise<MemberGroup[]> {
  const qs = new URLSearchParams()
  if (type) qs.set('type', type)
  const data = await api<GroupsListData>(`/api/groups?${qs.toString()}`)
  return data.list
}

export function groupToForm(item: MemberGroup): GroupForm {
  return { name: item.name, type: item.type, description: item.description ?? '' }
}

export function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}
