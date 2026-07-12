import { fetchApi } from '@/lib/api'
import type { ApiPackage, ApiPackageForm } from './types'

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const PERIODS: ApiPackage['period'][] = ['month', 'year', 'permanent']

export const PERIOD_LABEL_KEY: Record<ApiPackage['period'], string> = {
  month: 'periodMonth',
  year: 'periodYear',
  permanent: 'periodPermanent',
}

export const EMPTY: ApiPackageForm = {
  name: '',
  price: '0',
  quota: '0',
  period: 'month',
  description: '',
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function packageToForm(p: ApiPackage): ApiPackageForm {
  return {
    name: p.name,
    price: String(p.price),
    quota: String(p.quota),
    period: p.period,
    description: p.description ?? '',
  }
}
