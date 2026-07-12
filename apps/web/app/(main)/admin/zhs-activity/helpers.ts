import { fetchApi } from '@/lib/api'
import type { ZhsActivity, ZhsActivityForm } from './types'

export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: ZhsActivityForm = {
  activityName: '',
  activityRule: '',
  activityRecharge: '',
  beginAmount: '',
  multiple: '',
  computing: '',
  beginTime: '',
  endTime: '',
  status: true,
}

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'activityName', title: '活动名称' },
  { key: 'activityRule', title: '活动规则' },
  { key: 'activityRecharge', title: '活动充值' },
  { key: 'beginAmount', title: '起始金额' },
  { key: 'multiple', title: '倍数' },
  { key: 'computing', title: '计算方式' },
  { key: 'beginTime', title: '开始时间' },
  { key: 'endTime', title: '结束时间' },
  { key: 'status', title: '状态', formatter: (v: unknown) => (v === 1 ? '启用' : '关闭') },
]

export function activityToForm(item: ZhsActivity): ZhsActivityForm {
  return {
    activityName: item.activityName ?? '',
    activityRule: item.activityRule ?? '',
    activityRecharge: item.activityRecharge ?? '',
    beginAmount: item.beginAmount ?? '',
    multiple: item.multiple ?? '',
    computing: item.computing ?? '',
    beginTime: item.beginTime ?? '',
    endTime: item.endTime ?? '',
    status: item.status === 1,
  }
}
