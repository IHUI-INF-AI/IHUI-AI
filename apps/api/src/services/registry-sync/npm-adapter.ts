import type { RegistrySourceType } from '@ihui/types'
import {
  type RawRegistryItem,
  type RegistryAdapter,
  type SyncOptions,
  RegistryAdapterError,
  fetchWithTimeout,
} from './types.js'

const NPM_REGISTRY = 'https://registry.npmjs.org'

interface NpmSearchResponse {
  objects: Array<{ package: NpmPackageInfo }>
}

interface NpmPackageInfo {
  name: string
  version: string
  description?: string
  keywords?: string[]
  author?: { name?: string } | string
  homepage?: string
  repository?: { type?: string; url?: string }
  links?: { npm?: string }
}

const SEARCH_QUERIES: Record<'mcp' | 'skill' | 'plugin', string> = {
  mcp: '@modelcontextprotocol',
  skill: 'ihui-skill',
  plugin: 'ihui-plugin',
}

function extractAuthor(author: NpmPackageInfo['author']): string | null {
  if (!author) return null
  if (typeof author === 'string') return author
  return author.name ?? null
}

function extractRepoUrl(repo: NpmPackageInfo['repository']): string | null {
  if (!repo?.url) return null
  return repo.url.replace(/^git\+/, '').replace(/\.git$/, '')
}

export const npmAdapter: RegistryAdapter = {
  name: 'npm',
  source: 'npm',
  async fetch(sourceType: RegistrySourceType, options?: SyncOptions): Promise<RawRegistryItem[]> {
    const timeoutMs = options?.timeoutMs ?? 30000
    const query = SEARCH_QUERIES[sourceType as 'mcp' | 'skill' | 'plugin']
    if (!query) return []

    try {
      const res = await fetchWithTimeout(
        `${NPM_REGISTRY}/-/v1/search?text=${encodeURIComponent(query)}&size=50`,
        {},
        timeoutMs,
      )
      if (!res.ok) {
        throw new RegistryAdapterError(
          `npm search API returned ${res.status}`,
          'npm',
        )
      }
      const data = (await res.json()) as NpmSearchResponse
      return data.objects.map(
        (obj): RawRegistryItem => {
          const pkg = obj.package
          return {
            sourceType,
            source: 'npm',
            sourceId: pkg.name,
            name: pkg.name,
            description: pkg.description ?? null,
            version: pkg.version,
            author: extractAuthor(pkg.author),
            homepage: pkg.homepage ?? null,
            repoUrl: extractRepoUrl(pkg.repository),
            downloadUrl: pkg.links?.npm ?? `https://www.npmjs.com/package/${pkg.name}`,
            categories: [],
            tags: pkg.keywords ?? [],
            payload: pkg as unknown as Record<string, unknown>,
          }
        },
      )
    } catch (err) {
      if (err instanceof RegistryAdapterError) throw err
      throw new RegistryAdapterError(
        `npm adapter fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        'npm',
        err,
      )
    }
  },
}
