import { fetchApi } from '@/lib/api'

export const EMPTY_VARIABLE_FORM = {
  botId: '',
  variableName: '',
  variableValue: '',
  description: '',
  dataType: 'string',
}

export const DATA_TYPES = ['string', 'number', 'boolean', 'json', 'array']

export const inputCls =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground'

export const thCls = 'px-4 py-2.5 text-left font-medium'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
