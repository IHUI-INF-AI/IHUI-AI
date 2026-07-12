import { fetchApi } from '@/lib/api'
import type { Agreement, AgreementForm } from './types'

export const AGREEMENT_TYPES = ['user-agreement', 'privacy-policy', 'terms-of-service'] as const

export const th = 'px-4 py-2.5 font-medium'

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const EMPTY_FORM: AgreementForm = {
  type: 'user-agreement',
  title: '',
  content: '',
  version: '',
  effectiveDate: '',
  status: 1,
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function toDatetimeLocalValue(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function agreementToForm(item: Agreement): AgreementForm {
  return {
    type: item.type,
    title: item.title,
    content: item.content,
    version: item.version,
    effectiveDate: toDatetimeLocalValue(item.effectiveDate),
    status: item.status,
  }
}

export function formToBody(form: AgreementForm) {
  const effectiveDate = form.effectiveDate
    ? new Date(form.effectiveDate).toISOString()
    : new Date().toISOString()
  return {
    type: form.type,
    title: form.title,
    content: form.content,
    version: form.version,
    effectiveDate,
    status: form.status,
  }
}
