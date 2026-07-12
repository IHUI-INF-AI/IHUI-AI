import { fetchApi } from '@/lib/api'
import type { CompanyType, CompanyTypeForm, CompanyTypesData } from './types'

export const PAGE_SIZE = 20

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchCompanyTypes(params: { page: number }): Promise<CompanyTypesData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  return api<CompanyTypesData>(`/api/admin/member/company-types?${qs.toString()}`)
}

export const EMPTY_FORM: CompanyTypeForm = {
  name: '',
  description: '',
  sort: '0',
  status: true,
}

export function companyTypeToForm(item: CompanyType): CompanyTypeForm {
  return {
    name: item.name,
    description: item.description ?? '',
    sort: String(item.sort),
    status: item.status === 1,
  }
}
