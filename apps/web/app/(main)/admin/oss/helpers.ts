import { fetchApi } from '@/lib/api'
import type { Driver, OssDriver, OssForm } from './types'

export const DRIVERS: Driver[] = ['local', 'aliyun-oss', 'tencent-cos', 'qiniu', 's3', 'minio']

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono'

export const th = 'px-4 py-2.5 font-medium'

export const EMPTY_FORM: OssForm = {
  name: '',
  driver: 'local',
  isEnabled: false,
  isDefault: false,
  sort: 0,
  description: '',
  credentialsJson: '{}',
  configJson: '{}',
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function normList(d: unknown): OssDriver[] {
  return Array.isArray(d) ? (d as OssDriver[]) : ((d as { list?: OssDriver[] })?.list ?? [])
}

export function parseJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s || '{}')
  } catch {
    return {}
  }
}

export function ossDriverToForm(c: OssDriver): OssForm {
  return {
    name: c.name,
    driver: c.driver,
    isEnabled: c.isEnabled,
    isDefault: c.isDefault,
    sort: c.sort,
    description: c.description ?? '',
    credentialsJson: JSON.stringify(c.credentials ?? {}, null, 2),
    configJson: JSON.stringify(c.config ?? {}, null, 2),
  }
}
