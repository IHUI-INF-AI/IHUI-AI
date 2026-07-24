import type { RegistrySourceType } from '@ihui/types'
import {
  type RawRegistryItem,
  type RegistryAdapter,
  type SyncOptions,
  RegistryAdapterError,
  fetchWithTimeout,
} from './types.js'

const NPM_REGISTRY = 'https://registry.npmjs.org'
const NPM_DOWNLOADS_API = 'https://api.npmjs.org/downloads/point/last-week'

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

interface NpmDownloadsResponse {
  downloads: number
  start: string
  end: string
  package: string
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

/** 查询单个包的周下载量,失败返回 0(不阻塞主流程) */
async function fetchWeeklyDownloads(
  packageName: string,
  timeoutMs: number,
): Promise<number> {
  try {
    const res = await fetchWithTimeout(
      `${NPM_DOWNLOADS_API}/${encodeURIComponent(packageName)}`,
      {},
      timeoutMs,
    )
    if (!res.ok) return 0
    const data = (await res.json()) as NpmDownloadsResponse
    return data.downloads ?? 0
  } catch {
    return 0
  }
}

/**
 * 分批查询多个包的周下载量,避免一次 Promise.all 触发 npm API 限流。
 * 每批 batchSize 个并发,批与批之间串行。
 */
async function fetchDownloadsBatched(
  packageNames: string[],
  timeoutMs: number,
  batchSize = 5,
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  for (let i = 0; i < packageNames.length; i += batchSize) {
    const batch = packageNames.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(name =>
        fetchWeeklyDownloads(name, timeoutMs).then(d => [name, d] as const),
      ),
    )
    for (const [name, d] of batchResults) result.set(name, d)
  }
  return result
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
      const packages = data.objects.map(obj => obj.package)
      // 分批查询周下载量,填入 meta.downloads 供热度评分消费
      const downloadsMap = await fetchDownloadsBatched(
        packages.map(p => p.name),
        timeoutMs,
      )
      return packages.map(
        (pkg): RawRegistryItem => ({
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
          meta: {
            downloads: downloadsMap.get(pkg.name) ?? 0,
            hasDocumentation: !!pkg.description,
          },
        }),
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
