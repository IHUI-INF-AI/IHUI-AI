import type { RegistrySourceType } from '@ihui/types'
import {
  type RawRegistryItem,
  type RegistryAdapter,
  type SyncOptions,
  RegistryAdapterError,
  fetchWithTimeout,
} from './types.js'

const DEFAULT_REGISTRY_URL = 'https://registry.ihui.ai/api/registry/items'

interface CustomRegistryResponse {
  items: RawRegistryItem[]
}

export const customRegistryAdapter: RegistryAdapter = {
  name: 'custom',
  source: 'custom',
  async fetch(sourceType: RegistrySourceType, options?: SyncOptions): Promise<RawRegistryItem[]> {
    const timeoutMs = options?.timeoutMs ?? 15000
    const url =
      options?.customRegistryUrl ??
      process.env.IHUI_CUSTOM_REGISTRY_URL ??
      DEFAULT_REGISTRY_URL

    try {
      const res = await fetchWithTimeout(
        `${url}?source_type=${encodeURIComponent(sourceType)}`,
        {},
        timeoutMs,
      )
      if (!res.ok) {
        throw new RegistryAdapterError(
          `Custom registry returned ${res.status} for ${url}`,
          'custom',
        )
      }
      const data = (await res.json()) as CustomRegistryResponse
      return data.items ?? []
    } catch (err) {
      if (err instanceof RegistryAdapterError) throw err
      throw new RegistryAdapterError(
        `Custom registry fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        'custom',
        err,
      )
    }
  },
}
