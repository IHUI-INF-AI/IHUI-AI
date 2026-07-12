import { fetchApi } from '@/lib/api'
import type { Product, ProductForm } from './types'

export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: ProductForm = {
  name: '',
  category: '',
  price: '0',
  stock: '0',
  sales: '0',
  desc: '',
  images: [] as string[],
  status: true,
  type: '',
  denomination: '',
  denominationVip: '',
  denominationOperate: '',
}

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'name', title: '商品名称' },
  { key: 'price', title: '价格(分)' },
  { key: 'stock', title: '库存' },
  { key: 'sales', title: '销量' },
  { key: 'category', title: '分类' },
  { key: 'desc', title: '描述' },
  {
    key: 'status',
    title: '状态',
    formatter: (v: unknown) => (v === 'online' || v === 1 ? '上架' : '下架'),
  },
  { key: 'type', title: '类型' },
  { key: 'denomination', title: '面额' },
  { key: 'denominationVip', title: 'VIP面额' },
  { key: 'denominationOperate', title: '运营商面额' },
]

export function toArrayImages(v?: string | string[]): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  return String(v).split(',').filter(Boolean)
}

export function productToForm(p: Product): ProductForm {
  return {
    name: p.name,
    category: p.category,
    price: String(p.price),
    stock: String(p.stock),
    sales: String(p.sales ?? 0),
    desc: p.desc ?? '',
    images: toArrayImages(p.images),
    status: p.status === 'online',
    type: p.type ?? '',
    denomination: p.denomination ?? '',
    denominationVip: p.denominationVip ?? '',
    denominationOperate: p.denominationOperate ?? '',
  }
}
