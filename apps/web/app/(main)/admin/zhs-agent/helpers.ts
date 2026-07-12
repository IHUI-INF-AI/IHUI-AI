import { fetchApi } from '@/lib/api'
import type { ZhsAgent, ZhsAgentForm } from './types'

export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: ZhsAgentForm = {
  name: '',
  consume: '',
  image: '',
  url: '',
  info: '',
  remark: '',
  seqencing: '0',
  price: '',
  heat: '',
  field1: '',
}

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'name', title: '名称' },
  { key: 'consume', title: '消耗' },
  { key: 'image', title: '图片' },
  { key: 'url', title: 'URL' },
  { key: 'info', title: '信息' },
  { key: 'remark', title: '备注' },
  { key: 'seqencing', title: '排序' },
  { key: 'price', title: '价格' },
  { key: 'type', title: '类型' },
  { key: 'typeName', title: '类型名称' },
  { key: 'heat', title: '热度' },
]

export function zhsAgentToForm(item: ZhsAgent): ZhsAgentForm {
  return {
    name: item.name ?? '',
    consume: item.consume ?? '',
    image: item.image ?? '',
    url: item.url ?? '',
    info: item.info ?? '',
    remark: item.remark ?? '',
    seqencing: String(item.seqencing ?? 0),
    price: item.price ?? '',
    heat: item.heat ?? '',
    field1: item.field1 ?? '',
  }
}
