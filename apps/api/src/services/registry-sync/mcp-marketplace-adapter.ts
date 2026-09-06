// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { RegistrySourceType } from '@ihui/types'
import {
  type RawRegistryItem,
  type RegistryAdapter,
  type SyncOptions,
  fetchWithTimeout,
} from './types.js'

/**
 * marketplace 源定义。
 * 2026-09-06 实测修正:原先三个端点均返回 404(路径不存在),已替换为真实可用端点。
 * - mcp.so      :公开 API,limit/offset 分页,响应 { code, message, data: { servers: [...] } }
 * - smithery.ai :公开 Registry API,page/pageSize 分页,响应 { servers: [...], pagination }
 * - glama.ai    :需 API key(未授权返回 401),未配置 IHUI_GLAMA_API_KEY 时整源跳过,不计为失败
 */
interface MarketplaceSource {
  name: string
  buildUrl: (page: number, pageSize: number) => string
  /** 需要鉴权时给出环境变量名 */
  apiKeyEnv?: string
  apiKeyHeader?: string
}

const MARKETPLACE_SOURCES: MarketplaceSource[] = [
  {
    name: 'mcp.so',
    buildUrl: (page, size) =>
      `https://mcp.so/api/mcp-servers?limit=${size}&offset=${(page - 1) * size}`,
  },
  {
    name: 'smithery.ai',
    buildUrl: (page, size) => `https://registry.smithery.ai/servers?page=${page}&pageSize=${size}`,
  },
  {
    name: 'glama.ai',
    buildUrl: () => 'https://glama.ai/api/mcp/v1/servers',
    apiKeyEnv: 'IHUI_GLAMA_API_KEY',
    apiKeyHeader: 'x-api-key',
  },
]

const PAGE_SIZE = 100
/** 单源最多拉取页数(避免全量同步上万条拖垮 registry-sync) */
const MAX_PAGES = Number(process.env.IHUI_REGISTRY_MAX_PAGES ?? 3)

/** 读取某源的 API key;不需要鉴权的源返回 null */
function resolveApiKey(source: MarketplaceSource): string | null {
  if (!source.apiKeyEnv) return null
  const key = process.env[source.apiKeyEnv]
  return key && key.length > 0 ? key : null
}

/**
 * 从未知结构的响应中提取数组。
 * 兼顾顶层数组(mcp.so 的 data.servers 这类嵌套一层)与常见容器键。
 */
function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const key of ['servers', 'items', 'data', 'results']) {
      const value = obj[key]
      if (Array.isArray(value)) return value
      if (value && typeof value === 'object') {
        const nested = (value as Record<string, unknown>).servers
        if (Array.isArray(nested)) return nested
      }
    }
  }
  return []
}

function mapMarketplaceItem(item: unknown, market: string): RawRegistryItem | null {
  if (!item || typeof item !== 'object') return null
  const obj = item as Record<string, unknown>
  const name = String(
    obj.name ?? obj.displayName ?? obj.title ?? obj.qualifiedName ?? obj.slug ?? '',
  )
  if (!name) return null

  const authorRaw = obj.authorName ?? obj.author
  const author =
    typeof authorRaw === 'string'
      ? authorRaw
      : authorRaw && typeof authorRaw === 'object' && 'name' in authorRaw
        ? String((authorRaw as Record<string, unknown>).name)
        : obj.namespace
          ? String(obj.namespace)
          : null

  const starsRaw = obj.stars ?? obj.starCount ?? obj.useCount
  const slug = obj.slug ? String(obj.slug) : null
  return {
    sourceType: 'mcp',
    source: 'mcp_marketplace',
    sourceId: String(obj.id ?? obj.qualifiedName ?? slug ?? `${market}:${name}`),
    name,
    description: obj.description
      ? String(obj.description)
      : obj.summary
        ? String(obj.summary)
        : obj.tagline
          ? String(obj.tagline)
          : null,
    version: obj.version ? String(obj.version) : null,
    author,
    homepage: obj.homepage
      ? String(obj.homepage)
      : obj.url
        ? String(obj.url)
        : market === 'mcp.so' && slug
          ? `https://mcp.so/server/${slug}`
          : null,
    repoUrl: obj.repository ? String(obj.repository) : obj.github ? String(obj.github) : null,
    downloadUrl: obj.downloadUrl
      ? String(obj.downloadUrl)
      : obj.installUrl
        ? String(obj.installUrl)
        : null,
    categories: Array.isArray(obj.categories) ? obj.categories.map(String) : [],
    tags: Array.isArray(obj.tags)
      ? obj.tags.map(String)
      : Array.isArray(obj.keywords)
        ? obj.keywords.map(String)
        : [],
    payload: obj,
    meta: {
      stars: typeof starsRaw === 'number' ? starsRaw : undefined,
      hasDocumentation:
        (obj.documentation !== null && obj.documentation !== undefined) ||
        (obj.readme !== null && obj.readme !== undefined),
    },
  }
}

/**
 * 从单个 marketplace 源拉取条目,返回 { items, error, skipped }。
 * - skipped=true :源需鉴权但未配置 key,主动跳过(非故障)
 * - error 非 null:源故障(HTTP 错误或异常)
 * - 两者皆空     :成功(含"源正常但无数据")
 */
async function fetchFromMarket(
  source: MarketplaceSource,
  timeoutMs: number,
): Promise<{ items: RawRegistryItem[]; error: string | null; skipped: boolean }> {
  const apiKey = resolveApiKey(source)
  if (source.apiKeyEnv && !apiKey) {
    return { items: [], error: null, skipped: true }
  }

  const headers: Record<string, string> = {}
  if (apiKey && source.apiKeyHeader) headers[source.apiKeyHeader] = apiKey

  const items: RawRegistryItem[] = []
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetchWithTimeout(source.buildUrl(page, PAGE_SIZE), { headers }, timeoutMs)
      if (!res.ok) {
        // 首页即失败 → 判定源故障;后续页失败 → 保留已取数据并停止翻页
        return {
          items,
          error:
            items.length === 0
              ? `${source.name} returned ${res.status}`
              : `${source.name} page ${page} returned ${res.status}`,
          skipped: false,
        }
      }
      const data = await res.json()
      const arr = extractArray(data)
      for (const raw of arr) {
        const mapped = mapMarketplaceItem(raw, source.name)
        if (mapped) items.push(mapped)
      }
      if (arr.length < PAGE_SIZE) break // 已到最后一页
    }
    return { items, error: null, skipped: false }
  } catch (e) {
    return {
      items,
      error: e instanceof Error ? e.message : String(e),
      skipped: false,
    }
  }
}

export const mcpMarketplaceAdapter: RegistryAdapter = {
  name: 'mcp_marketplace',
  source: 'mcp_marketplace',
  async fetch(sourceType: RegistrySourceType, options?: SyncOptions): Promise<RawRegistryItem[]> {
    if (sourceType !== 'mcp') return []
    const timeoutMs = options?.timeoutMs ?? 20000

    const results = await Promise.all(
      MARKETPLACE_SOURCES.map((s) => fetchFromMarket(s, timeoutMs)),
    )
    // 未配置鉴权的源被跳过,不参与失败判定
    const active = results.filter((r) => !r.skipped)
    if (active.length === 0) return []

    const errors = results
      .map((r, i) => (r.error ? `${MARKETPLACE_SOURCES[i]?.name ?? 'unknown'}: ${r.error}` : null))
      .filter((e): e is string => e !== null)

    // 全部可用源都失败 → 抛错(让上层调度器感知并记录)
    if (errors.length > 0 && active.every((r) => r.items.length === 0)) {
      throw new Error(`All marketplace sources failed: ${errors.join('; ')}`)
    }
    // 部分失败 → 仅 warn(仍有部分源返回数据,不阻塞同步)
    if (errors.length > 0) {
      console.warn(`[registry-sync] mcp_marketplace partial failures: ${errors.join('; ')}`)
    }
    return results.flatMap((r) => r.items)
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
