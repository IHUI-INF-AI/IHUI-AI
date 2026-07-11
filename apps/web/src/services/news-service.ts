/**
 * 新闻服务（合并版）
 *
 * 合并自旧架构 services/news-*.ts 的 3 个文件：
 * - news-crawler / news-scheduler / news-storage
 *
 * 新架构基于 fetchApi 与纯 TypeScript，无 Vue 依赖。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

/* ------------------------------------------------------------------ */
/* 类型定义                                                            */
/* ------------------------------------------------------------------ */

export interface NewsSource {
  id: string
  name: string
  url: string
  type: 'rss' | 'html' | 'api' | 'weibo' | 'wechat'
  category: string
  enabled: boolean
  crawlIntervalMs: number
  lastCrawledAt: string | null
  lastError: string | null
  articleCount: number
}

export interface NewsArticle {
  id: string
  sourceId: string
  sourceName: string
  title: string
  summary: string
  content: string
  url: string
  cover: string | null
  author: string | null
  category: string
  tags: string[]
  publishedAt: string
  crawledAt: string
  status: 'pending' | 'published' | 'rejected' | 'archived'
  viewCount: number
  favoriteCount: number
  aiSummary: string | null
  aiTags: string[]
}

export interface NewsQuery {
  page?: number
  pageSize?: number
  keyword?: string
  category?: string
  sourceId?: string
  status?: NewsArticle['status']
  startDate?: string
  endDate?: string
  sort?: 'latest' | 'popular' | 'recommended'
}

export interface CrawlTask {
  id: string
  sourceId: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  newArticles: number
  error: string | null
  startedAt: string
  finishedAt: string | null
}

export interface ScheduleConfig {
  sourceId: string
  cronExpression: string
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string | null
}

/* ------------------------------------------------------------------ */
/* 抓取（crawler）                                                     */
/* ------------------------------------------------------------------ */

export async function crawlSource(sourceId: string): Promise<ApiResult<CrawlTask>> {
  return fetchApi<CrawlTask>(`/news/sources/${encodeURIComponent(sourceId)}/crawl`, {
    method: 'POST',
  })
}

export async function crawlAllSources(): Promise<
  ApiResult<{ queued: number; tasks: CrawlTask[] }>
> {
  return fetchApi<{ queued: number; tasks: CrawlTask[] }>('/news/crawl-all', {
    method: 'POST',
  })
}

export async function getCrawlTask(taskId: string): Promise<ApiResult<CrawlTask>> {
  return fetchApi<CrawlTask>(`/news/crawl-tasks/${encodeURIComponent(taskId)}`)
}

export async function retryFailedCrawls(): Promise<ApiResult<{ retried: number }>> {
  return fetchApi<{ retried: number }>('/news/crawl-retry', {
    method: 'POST',
  })
}

/* ------------------------------------------------------------------ */
/* 调度（scheduler）                                                   */
/* ------------------------------------------------------------------ */

export async function listSchedules(): Promise<ApiResult<ScheduleConfig[]>> {
  return fetchApi<ScheduleConfig[]>('/news/schedules')
}

export async function upsertSchedule(
  input: Omit<ScheduleConfig, 'lastRunAt' | 'nextRunAt'>,
): Promise<ApiResult<ScheduleConfig>> {
  return fetchApi<ScheduleConfig>('/news/schedules', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function pauseSchedule(sourceId: string): Promise<ApiResult<{ paused: boolean }>> {
  return fetchApi<{ paused: boolean }>(`/news/schedules/${encodeURIComponent(sourceId)}/pause`, {
    method: 'POST',
  })
}

export async function resumeSchedule(sourceId: string): Promise<ApiResult<{ resumed: boolean }>> {
  return fetchApi<{ resumed: boolean }>(`/news/schedules/${encodeURIComponent(sourceId)}/resume`, {
    method: 'POST',
  })
}

/* ------------------------------------------------------------------ */
/* 存储（storage）                                                     */
/* ------------------------------------------------------------------ */

export async function getNewsList(
  query: NewsQuery = {},
): Promise<ApiResult<PageData<NewsArticle>>> {
  return fetchApi<PageData<NewsArticle>>(`/news${buildQs(query)}`)
}

export async function getNewsById(id: string): Promise<ApiResult<NewsArticle>> {
  return fetchApi<NewsArticle>(`/news/${encodeURIComponent(id)}`)
}

export async function createNews(
  input: Omit<
    NewsArticle,
    'id' | 'crawledAt' | 'viewCount' | 'favoriteCount' | 'aiSummary' | 'aiTags'
  >,
): Promise<ApiResult<NewsArticle>> {
  return fetchApi<NewsArticle>('/news', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateNews(
  id: string,
  input: Partial<
    Pick<
      NewsArticle,
      | 'title'
      | 'summary'
      | 'content'
      | 'status'
      | 'category'
      | 'tags'
      | 'cover'
      | 'aiSummary'
      | 'aiTags'
    >
  >,
): Promise<ApiResult<NewsArticle>> {
  return fetchApi<NewsArticle>(`/news/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteNews(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/news/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function archiveNews(id: string): Promise<ApiResult<{ archived: boolean }>> {
  return fetchApi<{ archived: boolean }>(`/news/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
  })
}

/* ------------------------------------------------------------------ */
/* 源管理                                                              */
/* ------------------------------------------------------------------ */

export async function listSources(): Promise<ApiResult<NewsSource[]>> {
  return fetchApi<NewsSource[]>('/news/sources')
}

export async function createSource(
  input: Omit<NewsSource, 'id' | 'lastCrawledAt' | 'lastError' | 'articleCount'>,
): Promise<ApiResult<NewsSource>> {
  return fetchApi<NewsSource>('/news/sources', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateSource(
  id: string,
  input: Partial<Pick<NewsSource, 'name' | 'url' | 'category' | 'enabled' | 'crawlIntervalMs'>>,
): Promise<ApiResult<NewsSource>> {
  return fetchApi<NewsSource>(`/news/sources/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteSource(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/news/sources/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/* ------------------------------------------------------------------ */
/* AI 增强                                                             */
/* ------------------------------------------------------------------ */

export async function generateNewsSummary(
  id: string,
): Promise<ApiResult<{ summary: string; tags: string[] }>> {
  return fetchApi<{ summary: string; tags: string[] }>(
    `/news/${encodeURIComponent(id)}/ai-summary`,
    { method: 'POST' },
  )
}

export async function batchGenerateSummaries(
  ids: string[],
): Promise<ApiResult<{ processed: number; failed: number }>> {
  return fetchApi<{ processed: number; failed: number }>('/news/batch-ai-summary', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}
