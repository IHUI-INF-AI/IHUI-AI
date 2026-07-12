import { fetchApi } from '@/lib/api'
import type { Lecturer, LecturerForm, LecturersData } from './types'

export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchLecturers(params: { page: number; search: string }): Promise<LecturersData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) qs.set('name', params.search)
  return api<LecturersData>(`/api/admin/live/lecturers?${qs.toString()}`)
}

export const EMPTY_FORM: LecturerForm = {
  name: '',
  title: '',
  avatar: '',
  intro: '',
  sort: '0',
  status: true,
}

export function lecturerToForm(l: Lecturer): LecturerForm {
  return {
    name: l.name,
    title: l.title ?? '',
    avatar: l.avatar ?? '',
    intro: l.intro ?? '',
    sort: String(l.sort),
    status: l.status === 1,
  }
}
