import { fetchApi } from '@/lib/api'
import type { Product, ProductForm, ProductsData } from './types'

export const PAGE_SIZE = 10

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchProducts(params: { page: number; search: string }): Promise<ProductsData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) qs.set('name', params.search)
  return api<ProductsData>(`/api/admin/resources/products?${qs.toString()}`)
}

export const EMPTY_FORM: ProductForm = {
  resourceId: '',
  name: '',
  price: '0',
  originalPrice: '',
  description: '',
  isPublished: false,
  sort: '0',
}

export function productToForm(p: Product): ProductForm {
  return {
    resourceId: p.resourceId,
    name: p.name,
    price: p.price,
    originalPrice: p.originalPrice ?? '',
    description: p.description ?? '',
    isPublished: p.isPublished,
    sort: String(p.sort),
  }
}
