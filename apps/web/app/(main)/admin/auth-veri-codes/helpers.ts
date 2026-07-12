import { fetchApi } from '@/lib/api'
import type { ExportColumn } from '@/lib/export-utils'
import type { AuthVeriCode, AuthVeriCodeForm, AuthVeriCodeSearch } from './types'

export const PAGE_SIZE = 10
export const RESOURCE = '/api/admin/auth-veri-codes'
export const PERM = 'auth:auth_veri_codes'

export const th = 'px-4 py-2.5 font-medium'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_SEARCH: AuthVeriCodeSearch = { userId: '', phone: '', platform: '' }

export const EMPTY_FORM: AuthVeriCodeForm = {
  userId: '',
  phone: '',
  code: '',
  type: '',
  platform: '',
  ip: '',
  expiresAt: '',
  used: '',
  usedAt: '',
  createdAt: '',
}

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'userId', title: '用户ID' },
  { key: 'phone', title: '手机号' },
  { key: 'code', title: '验证码' },
  { key: 'type', title: '类型' },
  { key: 'platform', title: '平台' },
  { key: 'ip', title: 'IP' },
  { key: 'expiresAt', title: '过期时间' },
  { key: 'used', title: '是否已用' },
  { key: 'usedAt', title: '使用时间' },
]

export function authVeriCodeToForm(item: AuthVeriCode): AuthVeriCodeForm {
  return {
    userId: item.userId ?? '',
    phone: item.phone ?? '',
    code: item.code ?? '',
    type: item.type ?? '',
    platform: item.platform ?? '',
    ip: item.ip ?? '',
    expiresAt: item.expiresAt ?? '',
    used: String(item.used ?? ''),
    usedAt: item.usedAt ?? '',
    createdAt: item.createdAt ?? '',
  }
}

export function buildParams(search: AuthVeriCodeSearch, page: number): Record<string, string> {
  const p: Record<string, string> = { pageNum: String(page), pageSize: String(PAGE_SIZE) }
  Object.entries(search).forEach(([k, v]) => {
    if (v.trim()) p[k] = v.trim()
  })
  return p
}
