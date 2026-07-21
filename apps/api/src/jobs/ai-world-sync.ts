/**
 * AI World 数据同步任务
 *
 * 数据源(只用原始源,严禁抓 ai-bot.cn):
 * 1. AI 资讯官方 blog RSS(OpenAI / Anthropic / DeepMind / Meta AI / Microsoft AI / Hugging Face)
 * 2. AI 论文(arXiv cs.AI+cs.CL)
 * 3. GitHub Trending(topic: ai / llm / machine-learning,走 GitHub REST API search/repositories)
 * 4. AI APP 元数据(各 AI 官网 + Google Play + App Store 官方页面)
 *
 * 调度:node-cron `0 0,12 * * *`(每日 0 点 + 12 点各跑一次,12 小时间隔)
 * 失败重试:单源 3 次重试,3 次失败写 aiWorldSyncLog 表 + 跳过,不阻塞其他源
 * LLM 改写:可选,读 AI_WORLD_LLM_REWRITE_URL 环境变量调 ai-service HTTP,失败降级用原始摘要
 */

import cron, { type ScheduledTask } from 'node-cron'
import RSSParser from 'rss-parser'
import * as cheerio from 'cheerio'
import { and, eq } from 'drizzle-orm'
import {
  aiWorldCategories,
  aiWorldItems,
  aiWorldSyncLog,
  type NewAiWorldItem,
} from '@ihui/database'

import { db } from '../db/index.js'

// ===== 类型定义 =====

export type ItemKind = 'news' | 'paper' | 'project' | 'tool' | 'app'

export interface FetchedItem {
  kind: ItemKind
  source: string
  sourceUrl: string
  title: string
  summary?: string
  content?: string
  url?: string
  coverImage?: string
  publishedAt?: Date
  metadata?: Record<string, unknown>
}

export interface SyncSourceResult {
  source: string
  kind: ItemKind
  status: 'success' | 'failed'
  itemCount: number
  error?: string
  startedAt: Date
  finishedAt?: Date
}

// ===== 数据源配置 =====

const RSS_FEEDS: Array<{ source: string; url: string; kind: ItemKind }> = [
  { source: 'openai', url: 'https://openai.com/blog/rss.xml', kind: 'news' },
  { source: 'anthropic', url: 'https://www.anthropic.com/news/rss.xml', kind: 'news' },
  { source: 'deepmind', url: 'https://deepmind.google/blog/rss.xml', kind: 'news' },
  { source: 'meta-ai', url: 'https://ai.meta.com/blog/rss/', kind: 'news' },
  { source: 'microsoft-ai', url: 'https://blogs.microsoft.com/ai/feed/', kind: 'news' },
  { source: 'huggingface-blog', url: 'https://huggingface.co/blog/feed.xml', kind: 'news' },
]

const ARXIV_CATEGORIES = ['cs.AI', 'cs.CL']
const ARXIV_MAX_RESULTS = 30

const GITHUB_TOPICS = ['ai', 'llm', 'machine-learning']
const GITHUB_MAX_RESULTS = 30

// AI APP 元数据(只取官网 title + description,不抓 ai-bot.cn)
const AI_APPS: Array<{ source: string; name: string; url: string; category: string }> = [
  { source: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com', category: 'chat' },
  { source: 'claude', name: 'Claude', url: 'https://claude.ai', category: 'chat' },
  { source: 'gemini', name: 'Gemini', url: 'https://gemini.google.com', category: 'chat' },
  { source: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com', category: 'chat' },
  { source: 'kimi', name: 'Kimi', url: 'https://kimi.moonshot.cn', category: 'chat' },
  { source: 'doubao', name: 'Doubao', url: 'https://www.doubao.com', category: 'chat' },
  { source: 'tongyi', name: 'Qwen', url: 'https://tongyi.aliyun.com', category: 'chat' },
  { source: 'wenxin', name: 'Wenxin', url: 'https://yiyan.baidu.com', category: 'chat' },
  { source: 'zhipu', name: 'Zhipu', url: 'https://chatglm.cn', category: 'chat' },
  { source: 'midjourney', name: 'Midjourney', url: 'https://www.midjourney.com', category: 'image' },
  { source: 'sora', name: 'Sora', url: 'https://sora.com', category: 'video' },
  { source: 'suno', name: 'Suno', url: 'https://suno.com', category: 'music' },
  { source: 'hunyuan', name: 'Hunyuan', url: 'https://hunyuan.tencent.com', category: 'multimodal' },
  { source: 'cursor', name: 'Cursor', url: 'https://cursor.com', category: 'code' },
  { source: 'copilot', name: 'GitHub Copilot', url: 'https://github.com/features/copilot', category: 'code' },
]

// AI 工具(精选常用,从官网抓元数据)
const AI_TOOLS: Array<{ source: string; name: string; url: string; category: string }> = [
  { source: 'stable-diffusion', name: 'Stable Diffusion', url: 'https://stability.ai', category: 'image' },
  { source: 'flux', name: 'FLUX', url: 'https://blackforestlabs.ai', category: 'image' },
  { source: 'runway', name: 'Runway', url: 'https://runwayml.com', category: 'video' },
  { source: 'pika', name: 'Pika', url: 'https://pika.art', category: 'video' },
  { source: 'elevenlabs', name: 'ElevenLabs', url: 'https://elevenlabs.io', category: 'audio' },
  { source: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai', category: 'search' },
  { source: 'huggingface', name: 'Hugging Face', url: 'https://huggingface.co', category: 'platform' },
  { source: 'replicate', name: 'Replicate', url: 'https://replicate.com', category: 'platform' },
  { source: 'langchain', name: 'LangChain', url: 'https://www.langchain.com', category: 'framework' },
  { source: 'llamaindex', name: 'LlamaIndex', url: 'https://www.llamaindex.ai', category: 'framework' },
]

// AI World 自定义分类(借鉴 ai-bot.cn 结构但重命名,不抄 slug)
export const AI_WORLD_CATEGORIES: Array<{ slug: string; name: string; description: string; icon: string; sort: number }> = [
  { slug: 'chat', name: '对话助手', description: '通用 AI 对话与聊天助手', icon: 'Bot', sort: 1 },
  { slug: 'image', name: '图像生成', description: 'AI 绘画、图像编辑与视觉创作', icon: 'Image', sort: 2 },
  { slug: 'video', name: '视频生成', description: 'AI 视频创作、剪辑与合成', icon: 'Video', sort: 3 },
  { slug: 'audio', name: '音频语音', description: 'AI 音乐、语音合成与音频处理', icon: 'Music', sort: 4 },
  { slug: 'code', name: '编程开发', description: 'AI 编程、代码生成与开发辅助', icon: 'Code', sort: 5 },
  { slug: 'search', name: '搜索问答', description: 'AI 搜索引擎与知识问答', icon: 'Search', sort: 6 },
  { slug: 'platform', name: '开发平台', description: 'AI 模型托管、训练与部署平台', icon: 'Cloud', sort: 7 },
  { slug: 'framework', name: '框架库', description: 'AI 应用开发框架与工具链', icon: 'Boxes', sort: 8 },
  { slug: 'multimodal', name: '多模态', description: '融合文本、图像、音频的多模态 AI', icon: 'Layers', sort: 9 },
  { slug: 'news', name: 'AI 资讯', description: 'AI 行业动态、官方博客与新闻', icon: 'Newspaper', sort: 10 },
  { slug: 'paper', name: 'AI 论文', description: 'arXiv 与 Hugging Face 每日论文', icon: 'FileText', sort: 11 },
  { slug: 'project', name: '开源项目', description: 'GitHub 趋势 AI 开源项目', icon: 'Github', sort: 12 },
]

// ===== 抓取器 =====

const rssParser = new RSSParser({
  timeout: 15000,
  headers: { 'User-Agent': 'IHUI-AI/1.0 AI-World-Sync' },
})

const fetchWithTimeout = async (url: string, opts: RequestInit = {}, timeoutMs = 15000): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** 抓 RSS feed(资讯类) */
async function fetchRssFeed(feed: { source: string; url: string; kind: ItemKind }): Promise<FetchedItem[]> {
  const res = await fetchWithTimeout(feed.url)
  if (!res.ok) throw new Error(`RSS ${feed.source} HTTP ${res.status}`)
  const xml = await res.text()
  const parsed = await rssParser.parseString(xml)
  return (parsed.items ?? []).slice(0, 30).map((item) => ({
    kind: feed.kind,
    source: feed.source,
    sourceUrl: item.link ?? item.guid ?? feed.url,
    title: item.title ?? 'Untitled',
    summary: item.contentSnippet ?? item.content ?? undefined,
    content: item.content ?? undefined,
    url: item.link ?? undefined,
    coverImage: item.enclosure?.url ?? undefined,
    publishedAt: item.isoDate ? new Date(item.isoDate) : undefined,
    metadata: { author: item.creator, categories: item.categories },
  }))
}

/** 抓 arXiv 论文(cs.AI + cs.CL) */
async function fetchArxivPapers(): Promise<FetchedItem[]> {
  const searchQuery = ARXIV_CATEGORIES.map((c) => `cat:${c}`).join('+OR+')
  const url = `http://export.arxiv.org/api/query?search_query=${searchQuery}&sortBy=submittedDate&sortOrder=descending&max_results=${ARXIV_MAX_RESULTS}`
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`arXiv HTTP ${res.status}`)
  const xml = await res.text()
  const parsed = await rssParser.parseString(xml)
  return (parsed.items ?? []).map((item) => ({
    kind: 'paper' as const,
    source: 'arxiv',
    sourceUrl: item.link ?? item.guid ?? '',
    title: item.title ?? 'Untitled',
    summary: item.contentSnippet ?? undefined,
    content: item.content ?? undefined,
    url: item.link ?? undefined,
    publishedAt: item.isoDate ? new Date(item.isoDate) : undefined,
    metadata: { authors: item.creator, categories: item.categories },
  }))
}

/** 抓 GitHub Trending(用 search/repositories API) */
async function fetchGithubTrending(): Promise<FetchedItem[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const items: FetchedItem[] = []
  for (const topic of GITHUB_TOPICS) {
    const url = `https://api.github.com/search/repositories?q=topic:${topic}+pushed:>${since}&sort=stars&order=desc&per_page=${Math.ceil(GITHUB_MAX_RESULTS / GITHUB_TOPICS.length)}`
    const res = await fetchWithTimeout(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'IHUI-AI/1.0 AI-World-Sync',
      },
    })
    if (!res.ok) throw new Error(`GitHub topic=${topic} HTTP ${res.status}`)
    const data = (await res.json()) as { items?: Array<Record<string, unknown>> }
    for (const repo of data.items ?? []) {
      const htmlUrl = String(repo.html_url ?? '')
      const description = repo.description ? String(repo.description) : undefined
      items.push({
        kind: 'project',
        source: 'github',
        sourceUrl: htmlUrl,
        title: String(repo.full_name ?? repo.name ?? 'Untitled'),
        summary: description,
        url: htmlUrl,
        coverImage: repo.owner && typeof repo.owner === 'object' && 'avatar_url' in repo.owner
          ? String((repo.owner as Record<string, unknown>).avatar_url)
          : undefined,
        publishedAt: repo.pushed_at ? new Date(String(repo.pushed_at)) : undefined,
        metadata: {
          stars: repo.stargazers_count,
          language: repo.language,
          topics: repo.topics,
          forks: repo.forks_count,
        },
      })
    }
  }
  // 去重(同 sourceUrl)
  const seen = new Set<string>()
  return items.filter((it) => {
    if (seen.has(it.sourceUrl)) return false
    seen.add(it.sourceUrl)
    return true
  }).slice(0, GITHUB_MAX_RESULTS)
}

/** 抓 AI APP / Tool 官网元数据(只取 title + meta description,不抓 ai-bot.cn) */
async function fetchSiteMeta(entry: { source: string; name: string; url: string; category: string }, kind: ItemKind): Promise<FetchedItem> {
  const res = await fetchWithTimeout(entry.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IHUI-AI/1.0 AI-World-Sync)' },
  })
  if (!res.ok) throw new Error(`${entry.name} HTTP ${res.status}`)
  const html = await res.text()
  const $ = cheerio.load(html)
  const title = $('title').first().text().trim() || entry.name
  const description = $('meta[name="description"]').attr('content')?.trim()
    || $('meta[property="og:description"]').attr('content')?.trim()
    || ''
  const ogImage = $('meta[property="og:image"]').attr('content') ?? undefined
  return {
    kind,
    source: entry.source,
    sourceUrl: entry.url,
    title: entry.name,
    summary: description || `${entry.name} 官方网站`,
    url: entry.url,
    coverImage: ogImage,
    metadata: { category: entry.category, siteTitle: title },
  }
}

// ===== LLM 改写(可选,失败降级用原始摘要) =====

async function rewriteSummaryWithLLM(item: FetchedItem): Promise<string | undefined> {
  const llmUrl = process.env.AI_WORLD_LLM_REWRITE_URL
  if (!llmUrl || !item.summary) return item.summary
  try {
    const res = await fetchWithTimeout(llmUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: item.summary,
        kind: item.kind,
        source: item.source,
        max_length: 200,
      }),
    }, 10000)
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`)
    const data = (await res.json()) as { rewritten?: string }
    return data.rewritten ?? item.summary
  } catch {
    // 降级:用原始摘要
    return item.summary
  }
}

// ===== 数据库操作 =====

/** 确保分类存在(首次同步时初始化) */
export async function ensureCategories(): Promise<void> {
  for (const cat of AI_WORLD_CATEGORIES) {
    const existing = await db
      .select({ id: aiWorldCategories.id })
      .from(aiWorldCategories)
      .where(eq(aiWorldCategories.slug, cat.slug))
      .limit(1)
    if (existing.length === 0) {
      await db.insert(aiWorldCategories).values({
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        sort: cat.sort,
        status: 1,
      }).onConflictDoNothing()
    }
  }
}

/** 通过 slug 查分类 ID */
async function getCategoryIdBySlug(slug: string): Promise<string | null> {
  const rows = await db
    .select({ id: aiWorldCategories.id })
    .from(aiWorldCategories)
    .where(eq(aiWorldCategories.slug, slug))
    .limit(1)
  return rows[0]?.id ?? null
}

// 保留导出供未来扩展使用(如按分类聚合 items)
export { getCategoryIdBySlug }

/** upsert 单个 item(kind + sourceUrl 唯一) */
async function upsertItem(item: FetchedItem): Promise<boolean> {
  if (!item.sourceUrl) return false
  const summary = await rewriteSummaryWithLLM(item)
  const existing = await db
    .select({ id: aiWorldItems.id })
    .from(aiWorldItems)
    .where(and(
      eq(aiWorldItems.kind, item.kind),
      eq(aiWorldItems.sourceUrl, item.sourceUrl),
    ))
    .limit(1)
  const payload: NewAiWorldItem = {
    kind: item.kind,
    categoryId: null,
    slug: null,
    title: item.title.slice(0, 500),
    summary: summary?.slice(0, 1000),
    content: item.content,
    url: item.url,
    coverImage: item.coverImage,
    source: item.source,
    sourceUrl: item.sourceUrl,
    publishedAt: item.publishedAt,
    fetchedAt: new Date(),
    metadata: item.metadata ?? {},
    status: 1,
  }
  if (existing.length > 0) {
    const existingId = existing[0]!.id
    await db
      .update(aiWorldItems)
      .set({
        title: payload.title,
        summary: payload.summary,
        content: payload.content,
        url: payload.url,
        coverImage: payload.coverImage,
        publishedAt: payload.publishedAt,
        fetchedAt: payload.fetchedAt,
        metadata: payload.metadata,
        updatedAt: new Date(),
      })
      .where(eq(aiWorldItems.id, existingId))
  } else {
    await db.insert(aiWorldItems).values(payload).onConflictDoNothing()
  }
  return true
}

/** 写同步日志 */
async function writeSyncLog(result: SyncSourceResult): Promise<void> {
  await db.insert(aiWorldSyncLog).values({
    source: result.source,
    kind: result.kind,
    status: result.status,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt ?? new Date(),
    itemCount: result.itemCount,
    error: result.error,
  })
}

// ===== 同步主流程 =====

const MAX_RETRY = 3

async function syncOneSourceWithRetry(
  source: string,
  kind: ItemKind,
  fetcher: () => Promise<FetchedItem[]>,
): Promise<SyncSourceResult> {
  const startedAt = new Date()
  let lastError: string | undefined
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const items = await fetcher()
      let count = 0
      for (const item of items) {
        if (await upsertItem(item)) count++
      }
      const result: SyncSourceResult = {
        source, kind, status: 'success', itemCount: count, startedAt, finishedAt: new Date(),
      }
      await writeSyncLog(result)
      return result
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      if (attempt < MAX_RETRY) {
        await new Promise((r) => setTimeout(r, 1000 * attempt))
      }
    }
  }
  const failed: SyncSourceResult = {
    source, kind, status: 'failed', itemCount: 0, startedAt, finishedAt: new Date(), error: lastError,
  }
  await writeSyncLog(failed)
  return failed
}

/** 同步所有源 */
export async function syncAllSources(): Promise<SyncSourceResult[]> {
  await ensureCategories()
  const results: SyncSourceResult[] = []

  // 1. RSS 资讯(6 个源,并行)
  const rssResults = await Promise.all(
    RSS_FEEDS.map((feed) => syncOneSourceWithRetry(feed.source, feed.kind, () => fetchRssFeed(feed))),
  )
  results.push(...rssResults)

  // 2. arXiv 论文
  results.push(await syncOneSourceWithRetry('arxiv', 'paper', fetchArxivPapers))

  // 3. GitHub Trending
  results.push(await syncOneSourceWithRetry('github', 'project', fetchGithubTrending))

  // 4. AI APP 元数据(并行)
  const appResults = await Promise.all(
    AI_APPS.map((entry) => syncOneSourceWithRetry(entry.source, 'app', async () => [await fetchSiteMeta(entry, 'app')])),
  )
  results.push(...appResults)

  // 5. AI 工具元数据(并行)
  const toolResults = await Promise.all(
    AI_TOOLS.map((entry) => syncOneSourceWithRetry(entry.source, 'tool', async () => [await fetchSiteMeta(entry, 'tool')])),
  )
  results.push(...toolResults)

  return results
}

// ===== 调度器 =====

let scheduledTask: ScheduledTask | null = null

/** 启动定时任务(在 server.ts 注册) */
export function startAiWorldSyncScheduler(): void {
  if (scheduledTask) return
  // 每日 0 点 + 12 点(对应 12 小时间隔)
  scheduledTask = cron.schedule('0 0,12 * * *', async () => {
    try {
      const results = await syncAllSources()
      const ok = results.filter((r) => r.status === 'success').length
      const fail = results.filter((r) => r.status === 'failed').length
      console.log(`[ai-world-sync] done: ${ok} success, ${fail} failed`)
    } catch (err) {
      console.error('[ai-world-sync] fatal:', err)
    }
  }, {
    timezone: 'Asia/Shanghai',
  })
  console.log('[ai-world-sync] scheduler started (cron: 0 0,12 * * * Asia/Shanghai)')
}

/** 停止定时任务 */
export function stopAiWorldSyncScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
  }
}

// ===== CLI 入口(--run-once 手动触发) =====

// 检测 CLI 调用:tsx apps/api/src/jobs/ai-world-sync.ts --run-once
const isCli = process.argv[1]?.endsWith('ai-world-sync.ts') || process.argv[1]?.endsWith('ai-world-sync.js')
if (isCli && process.argv.includes('--run-once')) {
  ;(async () => {
    try {
      console.log('[ai-world-sync] run-once start')
      const results = await syncAllSources()
      const ok = results.filter((r) => r.status === 'success').length
      const fail = results.filter((r) => r.status === 'failed').length
      console.log(`[ai-world-sync] run-once done: ${ok} success, ${fail} failed`)
      for (const r of results) {
        console.log(`  - ${r.source} (${r.kind}): ${r.status} items=${r.itemCount}${r.error ? ` err=${r.error}` : ''}`)
      }
      process.exit(fail > 0 ? 1 : 0)
    } catch (err) {
      console.error('[ai-world-sync] run-once fatal:', err)
      process.exit(1)
    }
  })()
}
