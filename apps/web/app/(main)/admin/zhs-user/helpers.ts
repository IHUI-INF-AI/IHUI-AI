import { fetchApi } from '@/lib/api'
import { exportToExcel } from '@/lib/export-utils'
import type { ZhsUser, FieldDef } from './types'

export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const FIELDS: FieldDef[] = [
  { key: 'token', label: 'Token' },
  { key: 'openId', label: 'OpenID', required: true },
  { key: 'nickname', label: '昵称', required: true },
  { key: 'userName', label: '用户名' },
  { key: 'avatar', label: '头像' },
  { key: 'card', label: '身份证' },
  { key: 'phone', label: '手机' },
  { key: 'inviteCode', label: '邀请码', required: true },
  { key: 'parentId', label: '父ID' },
  { key: 'balance', label: '余额' },
  { key: 'totalEarnings', label: '总收益', required: true },
  { key: 'isVip', label: 'VIP' },
  { key: 'identityTypy', label: '身份类型' },
  { key: 'commissionRatio', label: '佣金比例' },
  { key: 'tokenQuantity', label: 'Token数量' },
]

export const EMPTY: Record<string, string> = Object.fromEntries(FIELDS.map((f) => [f.key, '']))

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'nickname', title: '昵称' },
  { key: 'userName', title: '用户名' },
  { key: 'phone', title: '手机' },
  { key: 'inviteCode', title: '邀请码' },
  { key: 'balance', title: '余额' },
  { key: 'totalEarnings', title: '总收益' },
  { key: 'isVip', title: 'VIP' },
  { key: 'identityTypy', title: '身份类型' },
  { key: 'commissionRatio', title: '佣金比例' },
  { key: 'tokenQuantity', title: 'Token数量' },
  { key: 'createdAt', title: '创建时间' },
]

export function zhsUserToForm(item: ZhsUser): Record<string, string> {
  const f: Record<string, string> = {}
  FIELDS.forEach((fld) => {
    f[fld.key] = String(item[fld.key] ?? '')
  })
  return f
}

export function buildQuery(search: Record<string, string>, page: number): string {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  Object.entries(search).forEach(([k, v]) => {
    if (v) qs.set(k, v)
  })
  return qs.toString()
}

export function exportZhsUser(list: ZhsUser[]) {
  exportToExcel('ZHS用户', EXPORT_COLUMNS, list as unknown as Record<string, unknown>[])
}
