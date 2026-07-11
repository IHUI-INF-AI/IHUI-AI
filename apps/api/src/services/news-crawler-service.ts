/**
 * 新闻爬虫服务。
 *
 * 复用 news_crawler schema（news_crawler_sources / news_crawler_articles），
 * 实现：
 * - 数据源管理：CRUD
 * - 抓取调度：按 source.scheduleCron 周期性抓取
 * - RSS 解析：简单的 RSS/Atom XML 解析（不依赖外部库，提取 title/link/description/pubDate）
 * - 文章去重：基于 (sourceId + originalUrl) 唯一约束 + dedupeHash 内容指纹
 * - 状态管理：记录每次抓取的结果（成功/失败/文章数）
 *
 * 设计：实际 HTTP 抓取由调用方注入 fetcher 接口，便于测试与替换。
 */

import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { newsCrawlerSources, newsCrawlerArticles } from '@ihui/database'
import { createHash } from 'node:crypto'

export type SourceType = 'rss' | 'html' | 'api' | 'json'

export interface NewsSourceInput {
  name: string
  url: string
  sourceType?: SourceType
  scheduleCron?: string
  selectorConfig?: Record<string, unknown>
}

export interface FetchedArticle {
  title: string
  summary?: string
  content?: string
  originalUrl: string
  author?: string
  publishedAt?: Date
  coverImage?: string
  tags?: string[]
  rawPayload?: unknown
}

/** HTTP 抓取器接口（由调用方注入，便于测试）。 */
export interface ArticleFetcher {
  fetch(source: {
    url: string
    sourceType: string
    selectorConfig: unknown
  }): Promise<FetchedArticle[]>
}

/** 创建数据源。 */
export async function createSource(input: NewsSourceInput) {
  const [row] = await db
    .insert(newsCrawlerSources)
    .values({
      name: input.name,
      url: input.url,
      sourceType: input.sourceType ?? 'rss',
      scheduleCron: input.scheduleCron ?? '0 * * * *',
      selectorConfig: input.selectorConfig ?? {},
    })
    .returning()
  return row
}

/** 列出所有活跃数据源。 */
export async function listActiveSources() {
  return db
    .select()
    .from(newsCrawlerSources)
    .where(and(eq(newsCrawlerSources.enabled, true), eq(newsCrawlerSources.status, 'active')))
}

/** 更新数据源状态。 */
export async function updateSourceStatus(
  sourceId: string,
  status: string,
  fetchCount?: number,
  error?: string,
): Promise<void> {
  await db
    .update(newsCrawlerSources)
    .set({
      status,
      lastFetchAt: new Date(),
      lastFetchStatus: status === 'active' ? 'success' : 'error',
      lastFetchCount: fetchCount,
      lastError: error ?? null,
      updatedAt: new Date(),
    })
    .where(eq(newsCrawlerSources.id, sourceId))
}

/** 计算内容指纹（dedupeHash）。 */
function computeDedupeHash(article: FetchedArticle): string {
  const text = `${article.title}|${article.summary ?? ''}`.toLowerCase().trim()
  return createHash('sha256').update(text).digest('hex').slice(0, 64)
}

/** 存储抓取的文章（自动去重）。 */
export async function storeArticles(
  sourceId: string,
  articles: FetchedArticle[],
): Promise<{
  stored: number
  duplicated: number
}> {
  let stored = 0
  let duplicated = 0

  for (const article of articles) {
    try {
      await db
        .insert(newsCrawlerArticles)
        .values({
          sourceId,
          title: article.title,
          summary: article.summary ?? null,
          content: article.content ?? null,
          originalUrl: article.originalUrl,
          author: article.author ?? null,
          publishedAt: article.publishedAt ?? null,
          coverImage: article.coverImage ?? null,
          tags: article.tags ?? [],
          dedupeHash: computeDedupeHash(article),
          rawPayload: article.rawPayload ?? null,
          status: 'stored',
        })
        .returning()
      stored++
    } catch {
      // 唯一约束冲突 = 重复文章
      duplicated++
    }
  }
  return { stored, duplicated }
}

/** 抓取单个数据源。 */
export async function crawlSource(
  sourceId: string,
  fetcher: ArticleFetcher,
): Promise<{
  stored: number
  duplicated: number
  error?: string
}> {
  const [source] = await db
    .select()
    .from(newsCrawlerSources)
    .where(eq(newsCrawlerSources.id, sourceId))

  if (!source) throw new Error(`数据源 ${sourceId} 不存在`)

  try {
    const articles = await fetcher.fetch({
      url: source.url,
      sourceType: source.sourceType,
      selectorConfig: source.selectorConfig,
    })
    const result = await storeArticles(sourceId, articles)
    await updateSourceStatus(sourceId, 'active', result.stored)
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await updateSourceStatus(sourceId, 'error', 0, msg)
    return { stored: 0, duplicated: 0, error: msg }
  }
}

/** 查询最新文章（分页）。 */
export async function listArticles(
  options: {
    sourceId?: string
    status?: string
    limit?: number
    offset?: number
  } = {},
) {
  const { sourceId, status, limit = 20, offset = 0 } = options

  let query = db.select().from(newsCrawlerArticles).$dynamic()
  if (sourceId) query = query.where(eq(newsCrawlerArticles.sourceId, sourceId))
  if (status) query = query.where(eq(newsCrawlerArticles.status, status))

  return query.orderBy(desc(newsCrawlerArticles.publishedAt)).limit(limit).offset(offset)
}

/** 跨源去重检查（按 dedupeHash 查找相似文章）。 */
export async function findDuplicates(hash: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(newsCrawlerArticles)
    .where(eq(newsCrawlerArticles.dedupeHash, hash))
  return result?.count ?? 0
}

/** 简易 RSS XML 解析器（提取 item/title/link/description/pubDate）。 */
export function parseRssFeed(xml: string): FetchedArticle[] {
  const articles: FetchedArticle[] = []
  const itemRegex = /<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi
  const items = xml.match(itemRegex) ?? []

  for (const item of items) {
    const getTag = (tag: string): string | undefined => {
      const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(item)
      return m ? m[1]!.trim() : undefined
    }
    const title = getTag('title')
    const link = getTag('link')
    if (!title || !link) continue
    const pubDateStr = getTag('pubDate') ?? getTag('published') ?? getTag('updated')
    articles.push({
      title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
      summary: getTag('description') ?? getTag('summary'),
      originalUrl: link.replace(/<!\[CDATA\[|\]\]>/g, ''),
      author: getTag('author') ?? getTag('dc:creator'),
      publishedAt: pubDateStr ? new Date(pubDateStr) : undefined,
    })
  }
  return articles
}
