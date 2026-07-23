import { fetchApi } from '@/lib/api'
import type {
  RegistryItemListResponse,
  RegistryItemDetailResponse,
  RegistrySyncLogListResponse,
  RegistrySyncResponse,
  InstallRegistryItemResponse,
  UpgradeAllResponse,
  ConfigDriftDetectResponse,
  ConfigMigrateResponse,
  RegistryItemListQuery,
  RegistrySourceType,
} from '@ihui/types'

const BASE = '/api/registry'

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(`${BASE}${path}`, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function qs(query: Record<string, unknown>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const registryApi = {
  listItems: (query: RegistryItemListQuery) =>
    api<RegistryItemListResponse>(`/items${qs(query as Record<string, unknown>)}`),
  getItem: (id: string) =>
    api<RegistryItemDetailResponse>(`/items/${encodeURIComponent(id)}`),
  listSyncLogs: (query: { page?: number; pageSize?: number }) =>
    api<RegistrySyncLogListResponse>(`/sync-logs${qs(query)}`),
  triggerSync: (body: { sourceType?: RegistrySourceType; source?: string; force?: boolean }) =>
    api<RegistrySyncResponse>(`/sync`, { method: 'POST', body: JSON.stringify(body) }),
  install: (body: { sourceType: RegistrySourceType; sourceId: string; version?: string }) =>
    api<InstallRegistryItemResponse>(`/install`, { method: 'POST', body: JSON.stringify(body) }),
  upgradeAll: (body: { sourceType?: RegistrySourceType }) =>
    api<UpgradeAllResponse>(`/upgrade-all`, { method: 'POST', body: JSON.stringify(body) }),
  detectConfigDrift: () => api<ConfigDriftDetectResponse>(`/config-drift`),
  migrateConfig: (body: { fileType?: string; dryRun?: boolean; rollbackThreshold?: number }) =>
    api<ConfigMigrateResponse>(`/config-migrate`, { method: 'POST', body: JSON.stringify(body) }),
}
