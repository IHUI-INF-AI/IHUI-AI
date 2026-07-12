import { fetchApi } from '@/lib/api'
import type { Integration, IntegrationForm, Provider } from './types'

export const PROVIDERS: Provider[] = [
  'openai',
  'anthropic',
  'google',
  'stripe',
  'alipay',
  'wechat',
  'oss',
  's3',
  'smtp',
  'webhook',
]

export const PROVIDER_INITIAL: Record<Provider, string> = {
  openai: 'O',
  anthropic: 'A',
  google: 'G',
  stripe: 'S',
  alipay: 'Z',
  wechat: 'W',
  oss: 'O',
  s3: 'S',
  smtp: 'M',
  webhook: 'H',
}

export const EMPTY_FORM: IntegrationForm = {
  name: '',
  provider: 'openai',
  credentials: '{\n  \n}',
  isEnabled: true,
}

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function normList(d: unknown): Integration[] {
  return Array.isArray(d) ? (d as Integration[]) : ((d as { list?: Integration[] })?.list ?? [])
}

export function credToString(c: Integration['credentials']): string {
  if (typeof c === 'string') return c
  try {
    return JSON.stringify(c, null, 2)
  } catch {
    return '{}'
  }
}

export function integrationToForm(i: Integration): IntegrationForm {
  return {
    name: i.name,
    provider: i.provider,
    credentials: credToString(i.credentials),
    isEnabled: i.isEnabled,
  }
}
