import { fetchApi } from '@/lib/api'
import type { ProductIdentity, ProductIdentityForm } from './types'

export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: ProductIdentityForm = {
  productName: '',
  amount: '',
  beginTime: '',
  endTime: '',
  defAmount: '',
  status: true,
  remark: '',
}

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'productName', title: '产品名称' },
  { key: 'amount', title: '金额' },
  { key: 'beginTime', title: '开始时间' },
  { key: 'endTime', title: '结束时间' },
  { key: 'defAmount', title: '默认金额' },
  { key: 'status', title: '状态', formatter: (v: unknown) => (v === 1 ? '启用' : '禁用') },
  { key: 'remark', title: '备注' },
]

export function productIdentityToForm(item: ProductIdentity): ProductIdentityForm {
  return {
    productName: item.productName ?? '',
    amount: item.amount ?? '',
    beginTime: item.beginTime ?? '',
    endTime: item.endTime ?? '',
    defAmount: item.defAmount ?? '',
    status: item.status === 1,
    remark: item.remark ?? '',
  }
}
