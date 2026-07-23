import type { RegistrySourceType } from '@ihui/types'
import { type RawRegistryItem, type RegistryAdapter, type SyncOptions, fetchWithTimeout } from './types.js'

const MARKETPLACE_SOURCES = [
  { name: 'mcp.so', url: 'https://mcp.so/api/items' },
  { name: 'smithery.ai', url: 'https://smithery.ai/api/servers' },
  { name: 'glama.ai', url: 'https://glama.ai/api/servers' },
] as const

/** 从未知结构的响应中提取数组 */
function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const key of ['items', 'servers', 'data', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[]
    }
  }
  return []
}

function mapMarketplaceItem(item: unknown, market: string): RawRegistryItem | null {
  if (!item || typeof item !== 'object') return null
  const obj = item as Record<string, unknown>
  const name = String(obj.name ?? obj.title ?? obj.displayName ?? '')
  if (!name) return null

  const authorRaw = obj.author
  const author =
    typeof authorRaw === 'string'
      ? authorRaw
      : authorRaw && typeof authorRaw === 'object' && 'name' in authorRaw
        ? String((authorRaw as Record<string, unknown>).name)
        : null

  const starsRaw = obj.stars ?? obj.starCount
  return {
    sourceType: 'mcp',
    source: 'mcp_marketplace',
    sourceId: String(obj.id ?? obj.slug ?? `${market}:${name}`),
    name,
    description: obj.description ? String(obj.description) : obj.summary ? String(obj.summary) : null,
    version: obj.version ? String(obj.version) : null,
    author,
    homepage: obj.homepage ? String(obj.homepage) : obj.url ? String(obj.url) : null,
    repoUrl: obj.repository ? String(obj.repository) : obj.github ? String(obj.github) : null,
    downloadUrl: obj.downloadUrl ? String(obj.downloadUrl) : obj.installUrl ? String(obj.installUrl) : null,
    categories: Array.isArray(obj.categories) ? obj.categories.map(String) : [],
    tags: Array.isArray(obj.tags)
      ? obj.tags.map(String)
      : Array.isArray(obj.keywords)
        ? obj.keywords.map(String)
        : [],
    payload: obj,
    meta: {
      stars: typeof starsRaw === 'number' ? starsRaw : undefined,
      hasDocumentation: obj.documentation != null || obj.readme != null,
    },
  }
}

async function fetchFromMarket(
  source: { name: string; url: string },
  timeoutMs: number,
): Promise<RawRegistryItem[]> {
  try {
    const res = await fetchWithTimeout(source.url, {}, timeoutMs)
    if (!res.ok) return []
    const data = await res.json()
    return extractArray(data)
      .map(item => mapMarketplaceItem(item, source.name))
      .filter((item): item is RawRegistryItem => item !== null)
  } catch {
    return []
  }
}

export const mcpMarketplaceAdapter: RegistryAdapter = {
  name: 'mcp_marketplace',
  source: 'mcp_marketplace',
  async fetch(sourceType: RegistrySourceType, options?: SyncOptions): Promise<RawRegistryItem[]> {
    if (sourceType !== 'mcp') return []
    const timeoutMs = options?.timeoutMs ?? 20000
    const results = await Promise.all(
      MARKETPLACE_SOURCES.map(s => fetchFromMarket(s, timeoutMs)),
    )
    return results.flat()
  },
}
