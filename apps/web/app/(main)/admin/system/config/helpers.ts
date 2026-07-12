import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Category, CfgType, SystemConfig, SystemConfigForm } from './types'

export const CATEGORIES: Category[] = [
  'general',
  'mail',
  'storage',
  'security',
  'payment',
  'ai',
  'system',
]
export const TYPES: CfgType[] = ['string', 'number', 'boolean', 'json']

export const CATEGORY_LABEL: Record<Category, string> = {
  general: '通用',
  mail: '邮件',
  storage: '存储',
  security: '安全',
  payment: '支付',
  ai: 'AI',
  system: '系统',
}

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const EMPTY: SystemConfigForm = {
  key: '',
  value: '',
  type: 'string' as CfgType,
  category: 'system' as Category,
  isPublic: false,
  description: '',
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function tabCls(active: boolean): string {
  return cn(
    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    active
      ? 'bg-background text-foreground shadow-sm'
      : 'text-muted-foreground hover:text-foreground',
  )
}

export function configToForm(c: SystemConfig): SystemConfigForm {
  return {
    key: c.key,
    value: c.value,
    type: c.type,
    category: c.category,
    isPublic: c.isPublic,
    description: c.description ?? '',
  }
}
