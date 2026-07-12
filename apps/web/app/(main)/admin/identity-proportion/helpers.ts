import { fetchApi } from '@/lib/api'
import type { IdentityProportion, IdentityProportionForm } from './types'

export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: IdentityProportionForm = {
  identityType: '',
  gift: '',
  tokenProportion: '',
  vipGift: '',
  routineProportion: '',
  beginTime: '',
  endTime: '',
  status: true,
}

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'identityType', title: '身份类型' },
  { key: 'gift', title: '赠送' },
  { key: 'tokenProportion', title: 'Token比例' },
  { key: 'vipGift', title: 'VIP赠送' },
  { key: 'routineProportion', title: '常规比例' },
  { key: 'beginTime', title: '开始时间' },
  { key: 'endTime', title: '结束时间' },
  { key: 'status', title: '状态', formatter: (v: unknown) => (v === 1 ? '启用' : '禁用') },
]

export function identityProportionToForm(item: IdentityProportion): IdentityProportionForm {
  return {
    identityType: item.identityType,
    gift: item.gift ?? '',
    tokenProportion: item.tokenProportion ?? '',
    vipGift: item.vipGift ?? '',
    routineProportion: item.routineProportion ?? '',
    beginTime: item.beginTime ?? '',
    endTime: item.endTime ?? '',
    status: item.status === 1,
  }
}
