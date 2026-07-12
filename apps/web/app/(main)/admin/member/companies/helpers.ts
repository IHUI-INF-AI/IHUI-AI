import { fetchApi } from '@/lib/api'
import type { CompaniesData, CompanyForm } from './types'

export const PAGE_SIZE = 20

export const EMPTY_FORM: CompanyForm = {
  name: '',
  contactName: '',
  contactPhone: '',
  address: '',
  remark: '',
  sort: '0',
  status: true,
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchCompanies(params: {
  page: number
  search: string
  status: string
}): Promise<CompaniesData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) qs.set('name', params.search)
  if (params.status) qs.set('status', params.status)
  return api<CompaniesData>(`/api/admin/members/companies?${qs.toString()}`)
}
