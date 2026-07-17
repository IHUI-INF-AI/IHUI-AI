import { fetchApi } from '@/lib/api'

export const RESOURCE = '/api/notifications/channels'
export const PAGE_SIZE = 10
export const TYPES = ['email', 'sms', 'push', 'in_app', 'webhook'] as const
export type ChannelType = (typeof TYPES)[number]

export interface Item {
  id: string
  name: string
  type: ChannelType
  config: Record<string, unknown> | null
  is_active: boolean
  remark: string | null
}

export interface ListData {
  list: Item[]
  total: number
  page: number
  pageSize: number
}

export interface FormState {
  name: string
  type: ChannelType
  configText: string
  isActive: boolean
  remark: string
}

export const EMPTY_FORM: FormState = {
  name: '',
  type: 'email',
  configText: '{}',
  isActive: true,
  remark: '',
}

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
export const textareaCls =
  'flex min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function itemToForm(item: Item): FormState {
  return {
    name: String(item.name ?? ''),
    type: (item.type ?? 'email') as ChannelType,
    configText: item.config ? JSON.stringify(item.config, null, 2) : '{}',
    isActive: !!item.is_active,
    remark: String(item.remark ?? ''),
  }
}

export function briefConfig(cfg: Record<string, unknown> | null): string {
  if (!cfg) return '-'
  const keys = Object.keys(cfg)
  if (keys.length === 0) return '{}'
  return keys.slice(0, 3).join(', ') + (keys.length > 3 ? '…' : '')
}
