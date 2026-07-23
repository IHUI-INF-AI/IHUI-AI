import type { RegistrySourceType, RegistryUpstreamSource } from '@ihui/types'
import { githubAdapter } from './github-adapter.js'
import { npmAdapter } from './npm-adapter.js'
import { mcpMarketplaceAdapter } from './mcp-marketplace-adapter.js'
import { customRegistryAdapter } from './custom-registry-adapter.js'
import type { RawRegistryItem, RegistryAdapter, SyncOptions } from './types.js'

export * from './types.js'
export { githubAdapter, npmAdapter, mcpMarketplaceAdapter, customRegistryAdapter }

const ADAPTERS: Record<RegistryUpstreamSource, RegistryAdapter> = {
  github: githubAdapter,
  npm: npmAdapter,
  mcp_marketplace: mcpMarketplaceAdapter,
  custom: customRegistryAdapter,
}

/** 计算热度评分:install_count + stars + recent_releases * 10 */
export function calculateHeatScore(raw: RawRegistryItem): number {
  const stars = raw.meta?.stars ?? 0
  const recentReleases = raw.meta?.recentReleases ?? 0
  return Math.round(stars + recentReleases * 10)
}

/** 计算质量评分:文档完整度(50)+ 维护活跃度(30)+ 兼容性(20) */
export function calculateQualityScore(raw: RawRegistryItem): number {
  const hasDoc = raw.meta?.hasDocumentation ? 50 : 0
  const lastCommit = raw.meta?.lastCommitAt ? new Date(raw.meta.lastCommitAt) : null
  const now = new Date()
  const daysSinceCommit = lastCommit
    ? Math.floor((now.getTime() - lastCommit.getTime()) / 86400000)
    : 999
  const maintenanceScore =
    daysSinceCommit < 30 ? 30 : daysSinceCommit < 90 ? 20 : daysSinceCommit < 365 ? 10 : 0
  const compatibilityScore = raw.tags.includes('stable') ? 20 : 10
  return hasDoc + maintenanceScore + compatibilityScore
}

/** 拉取所有源(或指定源)的条目,单源失败不影响其他源 */
export async function fetchAllRawItems(
  sourceType?: RegistrySourceType,
  source?: RegistryUpstreamSource,
  options?: SyncOptions,
): Promise<RawRegistryItem[]> {
  const sources: RegistryUpstreamSource[] = source
    ? [source]
    : ['github', 'npm', 'mcp_marketplace', 'custom']
  const types: RegistrySourceType[] = sourceType ? [sourceType] : ['mcp', 'skill', 'plugin']
  const results: RawRegistryItem[] = []
  for (const s of sources) {
    const adapter = ADAPTERS[s]
    if (!adapter) continue
    for (const t of types) {
      try {
        const items = await adapter.fetch(t, options)
        results.push(...items)
      } catch (err) {
        console.warn(
          `[registry-sync] adapter ${s} fetch ${t} failed:`,
          err instanceof Error ? err.message : String(err),
        )
      }
    }
  }
  return results
}

/** 计算条目 payload 的 SHA-256(用于变更检测) */
export async function computePayloadHash(payload: Record<string, unknown>): Promise<string> {
  const text = JSON.stringify(payload)
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
