import { fetchApi } from '@/lib/api'
import { exportFromApi, type ExportColumn } from '@/lib/export-utils'
import type { AuthFindInfo, AuthFindInfoForm, AuthFindInfoSearch } from './types'

export const RESOURCE = '/api/admin/auth-find-info'
export const PERM = 'auth:auth_find_info'
export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: AuthFindInfoForm = {
  userUuid: '',
  card: '',
  belong: '',
  title: '',
  message: '',
  createdAt: '',
}

export const EMPTY_SEARCH: AuthFindInfoSearch = {
  userUuid: '',
  card: '',
}

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'userUuid', title: '用户UUID' },
  { key: 'card', title: '银行卡号' },
  { key: 'belong', title: '所属银行' },
  { key: 'title', title: '标题' },
  { key: 'message', title: '消息' },
  { key: 'createdAt', title: '创建时间' },
]

export const TABLE_TH_CLASS = 'px-4 py-2.5 font-medium'

export function authFindInfoToForm(item: AuthFindInfo): AuthFindInfoForm {
  return {
    userUuid: item.userUuid ?? '',
    card: item.card ?? '',
    belong: item.belong ?? '',
    title: item.title ?? '',
    message: item.message ?? '',
    createdAt: item.createdAt ?? '',
  }
}

export function buildParams(
  search: AuthFindInfoSearch,
  page: number,
  pageSize: number,
): Record<string, string> {
  const p: Record<string, string> = {
    pageNum: String(page),
    pageSize: String(pageSize),
  }
  Object.entries(search).forEach(([k, v]) => {
    if (v.trim()) p[k] = v.trim()
  })
  return p
}

export async function exportAuthFindInfo(params: Record<string, string>): Promise<boolean> {
  return exportFromApi(`${RESOURCE}?${new URLSearchParams(params)}`, '用户资金账号', EXPORT_COLS)
}
