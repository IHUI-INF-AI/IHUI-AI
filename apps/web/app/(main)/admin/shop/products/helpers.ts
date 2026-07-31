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

export function getExportColumns(t: (key: string) => string) {
  return [
    { key: 'id', title: t('products.export.id') },
    { key: 'name', title: t('products.export.name') },
    { key: 'price', title: t('products.export.price') },
    { key: 'stock', title: t('products.export.stock') },
    { key: 'sales', title: t('products.export.sales') },
    { key: 'category', title: t('products.export.category') },
    { key: 'desc', title: t('products.export.desc') },
    {
      key: 'status',
      title: t('products.export.status'),
      formatter: (v: unknown) =>
        v === 'online' || v === 1 ? t('products.status.online') : t('products.status.offline'),
    },
    { key: 'type', title: t('products.export.type') },
    { key: 'denomination', title: t('products.export.denomination') },
    { key: 'denominationVip', title: t('products.export.denominationVip') },
    { key: 'denominationOperate', title: t('products.export.denominationOperate') },
  ]
}

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
