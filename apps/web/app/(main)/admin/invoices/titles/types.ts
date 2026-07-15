import { fetchApi } from '@/lib/api'

export interface InvoiceTitle {
  id: string
  titleName: string
  taxNo: string
  titleType: 'company' | 'personal'
  bankName?: string | null
  bankAccount?: string | null
  address?: string | null
  phone?: string | null
  isDefault: boolean
  createdAt: string
}

export interface TitlesData {
  list: InvoiceTitle[]
  total: number
}

export interface TitleForm {
  titleName: string
  taxNo: string
  titleType: 'company' | 'personal'
  bankName: string
  bankAccount: string
  address: string
  phone: string
  isDefault: boolean
}

export const PAGE_SIZE = 10

export const EMPTY_FORM: TitleForm = {
  titleName: '',
  taxNo: '',
  titleType: 'company',
  bankName: '',
  bankAccount: '',
  address: '',
  phone: '',
  isDefault: false,
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
