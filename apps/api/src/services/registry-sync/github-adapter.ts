import type { RegistrySourceType } from '@ihui/types'
import {
  type RawRegistryItem,
  type RegistryAdapter,
  type SyncOptions,
  RegistryAdapterError,
  fetchWithTimeout,
} from './types.js'

const GITHUB_API = 'https://api.github.com'

const REPO_MAP: Record<'mcp' | 'skill', { owner: string; repo: string }> = {
  mcp: { owner: 'modelcontextprotocol', repo: 'servers' },
  skill: { owner: 'anthropics', repo: 'skills' },
}

interface GitHubContentItem {
  name: string
  path: string
  type: string
  download_url: string | null
  html_url: string | null
}

interface GitHubSearchItem {
  name: string
  full_name: string
  description: string | null
  html_url: string
  homepage: string | null
  stargazers_count: number
  forks_count: number
  pushed_at: string
  owner: { login: string }
  topics?: string[]
}

interface GitHubRepoInfo {
  stargazers_count: number
  forks_count: number
  pushed_at: string
}

interface GitHubFileContent {
  content: string
  encoding: string
}

function authHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

/** 从 README 提取 name/description/categories/tags(frontmatter 优先,回退 H1 + 首段) */
function parseReadme(content: string): {
  name: string
  description: string | null
  categories: string[]
  tags: string[]
} {
  const lines = content.split('\n')
  let name = ''
  let description: string | null = null
  let categories: string[] = []
  let tags: string[] = []

  if (lines[0]?.trim() === '---') {
    const fm: Record<string, string> = {}
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!
      if (line.trim() === '---') break
      const idx = line.indexOf(':')
      if (idx > 0) {
        fm[line.slice(0, idx).trim()] = line
          .slice(idx + 1)
          .trim()
          .replace(/[\[\]'"]/g, '')
      }
    }
    name = fm['name'] ?? fm['title'] ?? ''
    description = fm['description'] ?? fm['summary'] ?? null
    categories = fm['categories']
      ? fm['categories'].split(',').map(s => s.trim()).filter(Boolean)
      : []
    tags = fm['tags'] ? fm['tags'].split(',').map(s => s.trim()).filter(Boolean) : []
  }

  if (!name) {
    const h1 = lines.find(l => l.startsWith('# '))
    if (h1) name = h1.slice(2).trim()
  }
  if (!description) {
    const desc = lines.find(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'))
    if (desc) description = desc.trim()
  }

  return { name: name || 'unknown', description, categories, tags }
}

async function fetchRepoInfo(
  owner: string,
  repo: string,
  token: string | undefined,
  timeoutMs: number,
): Promise<GitHubRepoInfo | null> {
  try {
    const res = await fetchWithTimeout(
      `${GITHUB_API}/repos/${owner}/${repo}`,
      { headers: authHeaders(token) },
      timeoutMs,
    )
    if (!res.ok) return null
    return (await res.json()) as GitHubRepoInfo
  } catch {
    return null
  }
}

async function fetchReadme(
  owner: string,
  repo: string,
  dirName: string,
  token: string | undefined,
  timeoutMs: number,
): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      `${GITHUB_API}/repos/${owner}/${repo}/contents/${dirName}/README.md`,
      { headers: authHeaders(token) },
      timeoutMs,
    )
    if (!res.ok) return null
    const data = (await res.json()) as GitHubFileContent
    return data.encoding === 'base64'
      ? Buffer.from(data.content, 'base64').toString('utf8')
      : data.content
  } catch {
    return null
  }
}

/** MCP / Skill:拉取仓库根目录子目录列表 + 每个子目录 README + 仓库级元数据 */
async function fetchFromContentsRepo(
  sourceType: 'mcp' | 'skill',
  options?: SyncOptions,
): Promise<RawRegistryItem[]> {
  const token = options?.githubToken
  const timeoutMs = options?.timeoutMs ?? 30000
  const { owner, repo } = REPO_MAP[sourceType]

  const listRes = await fetchWithTimeout(
    `${GITHUB_API}/repos/${owner}/${repo}/contents`,
    { headers: authHeaders(token) },
    timeoutMs,
  )
  if (listRes.status === 403) {
    throw new RegistryAdapterError(
      'GitHub API rate limit exceeded, set githubToken to increase limit',
      'github',
    )
  }
  if (!listRes.ok) {
    throw new RegistryAdapterError(
      `GitHub contents API returned ${listRes.status}`,
      'github',
    )
  }
  const items = (await listRes.json()) as GitHubContentItem[]
  const dirs = items.filter(i => i.type === 'dir')

  const [repoInfo, readmes] = await Promise.all([
    fetchRepoInfo(owner, repo, token, timeoutMs),
    Promise.all(dirs.map(d => fetchReadme(owner, repo, d.name, token, timeoutMs))),
  ])

  const results: RawRegistryItem[] = []
  for (const [i, dir] of dirs.entries()) {
    const readme = readmes[i] ?? null
    const parsed = readme
      ? parseReadme(readme)
      : { name: dir.name, description: null, categories: [], tags: [] }
    results.push({
      sourceType,
      source: 'github',
      sourceId: `${owner}/${repo}/${dir.name}`,
      name: parsed.name,
      description: parsed.description,
      version: null,
      author: owner,
      homepage: dir.html_url,
      repoUrl: dir.html_url,
      downloadUrl: dir.download_url,
      categories: parsed.categories,
      tags: parsed.tags,
      payload: dir as unknown as Record<string, unknown>,
      meta: {
        stars: repoInfo?.stargazers_count,
        forks: repoInfo?.forks_count,
        lastCommitAt: repoInfo?.pushed_at,
        hasDocumentation: !!readme,
      },
    })
  }
  return results
}

/** Plugin:搜索 topic:ihui-plugin,搜索结果已含 stars/forks/pushed_at */
async function fetchPlugins(options?: SyncOptions): Promise<RawRegistryItem[]> {
  const token = options?.githubToken
  const timeoutMs = options?.timeoutMs ?? 30000
  const res = await fetchWithTimeout(
    `${GITHUB_API}/search/repositories?q=topic:ihui-plugin&per_page=50`,
    { headers: authHeaders(token) },
    timeoutMs,
  )
  if (res.status === 403) {
    throw new RegistryAdapterError(
      'GitHub API rate limit exceeded, set githubToken to increase limit',
      'github',
    )
  }
  if (!res.ok) {
    throw new RegistryAdapterError(
      `GitHub search API returned ${res.status}`,
      'github',
    )
  }
  const data = (await res.json()) as { items: GitHubSearchItem[] }
  return data.items.map(
    (item): RawRegistryItem => ({
      sourceType: 'plugin',
      source: 'github',
      sourceId: item.full_name,
      name: item.name,
      description: item.description,
      version: null,
      author: item.owner.login,
      homepage: item.homepage ?? item.html_url,
      repoUrl: item.html_url,
      downloadUrl: item.html_url,
      categories: [],
      tags: item.topics ?? [],
      payload: item as unknown as Record<string, unknown>,
      meta: {
        stars: item.stargazers_count,
        forks: item.forks_count,
        lastCommitAt: item.pushed_at,
        hasDocumentation: item.description !== null,
      },
    }),
  )
}

export const githubAdapter: RegistryAdapter = {
  name: 'github',
  source: 'github',
  async fetch(sourceType: RegistrySourceType, options?: SyncOptions): Promise<RawRegistryItem[]> {
    try {
      if (sourceType === 'mcp') return await fetchFromContentsRepo('mcp', options)
      if (sourceType === 'skill') return await fetchFromContentsRepo('skill', options)
      if (sourceType === 'plugin') return await fetchPlugins(options)
      return []
    } catch (err) {
      if (err instanceof RegistryAdapterError) throw err
      throw new RegistryAdapterError(
        `GitHub adapter fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        'github',
        err,
      )
    }
  },
}
