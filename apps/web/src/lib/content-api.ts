/**
 * 内容相关 API
 * 合并迁移自旧架构：article, content-generation, docs, favorites, feedback, search, share
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

// ===================== 类型定义 =====================

export interface PageQuery {
  page?: number
  pageSize?: number
  [key: string]: string | number | undefined | null
}

/** 文章条目 */
export interface ArticleItem {
  id: string | number
  title: string
  summary?: string
  content?: string
  cover?: string
  authorId?: string | number
  authorName?: string
  authorAvatar?: string
  categoryId?: string | number
  categoryName?: string
  tagList?: string[]
  viewNum?: number
  likeNum?: number
  commentNum?: number
  favoriteNum?: number
  publishTime?: string
  updateTime?: string
  top?: boolean
  essence?: boolean
  link?: string
  [key: string]: unknown
}

/** 文章列表查询参数 */
export interface ArticleListParams extends PageQuery {
  keyword?: string
  categoryId?: string | number
  authorId?: string | number
  tag?: string
  top?: number
  essence?: number
}

/** 文章分类 */
export interface ArticleCategory {
  id: string | number
  name: string
  count?: number
}

/** 内容生成请求 */
export interface ContentGenerationParams {
  type: 'article' | 'summary' | 'title' | 'tags' | 'description' | 'translation' | 'rewrite'
  prompt: string
  content?: string
  model?: string
  length?: 'short' | 'medium' | 'long'
  language?: string
  [key: string]: unknown
}

/** 内容生成结果 */
export interface ContentGenerationResult {
  content: string
  type?: string
  model?: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
  [key: string]: unknown
}

/** 文档条目 */
export interface DocsItem {
  id: string
  slug: string
  title: string
  summary?: string
  content?: string
  category?: string
  order?: number
  updatedAt?: string
  [key: string]: unknown
}

/** 收藏条目 */
export interface FavoriteItem {
  id: string
  resourceType: string
  resourceId: string
  createdAt: string
  [key: string]: unknown
}

/** 反馈类型 */
export type FeedbackType = 'feature' | 'bug' | 'experience' | 'other'

/** 反馈状态 */
export type FeedbackStatus = 'pending' | 'processing' | 'resolved' | 'closed'

/** 反馈信息 */
export interface Feedback {
  id: string
  userId?: string
  type: FeedbackType
  content: string
  contact?: string
  images?: string[]
  status: FeedbackStatus
  createTime: string
  updateTime?: string
  reply?: string
  replyTime?: string
  [key: string]: unknown
}

/** 搜索结果条目 */
export interface SearchResult {
  id: string
  type: string
  title: string
  summary?: string
  cover?: string
  url?: string
  highlight?: string
  score?: number
  [key: string]: unknown
}

/** 搜索建议 */
export interface SearchSuggestion {
  keyword: string
  type?: string
  count?: number
  [key: string]: unknown
}

/** 分享内容 */
export interface ShareContent {
  id: string
  shareCode: string
  targetType?: string
  targetId?: string
  title?: string
  content?: string
  cover?: string
  url?: string
  authorId?: string
  authorName?: string
  createdAt?: string
  expireAt?: string
  viewCount?: number
  [key: string]: unknown
}

// ===================== article（文章） =====================

/** 获取文章列表 */
export async function getArticles(
  params: ArticleListParams = {},
): Promise<ApiResult<PageData<ArticleItem>>> {
  return fetchApi<PageData<ArticleItem>>(`/api/article/list${buildQs(params)}`)
}

/** 获取文章详情 */
export async function getArticleDetail(id: string | number): Promise<ApiResult<ArticleItem>> {
  return fetchApi<ArticleItem>(`/api/article/detail/${id}`)
}

/** 获取热门文章 */
export async function getHotArticles(limit = 10): Promise<ApiResult<ArticleItem[]>> {
  return fetchApi<ArticleItem[]>(`/api/article/hot${buildQs({ limit })}`)
}

/** 获取精选文章 */
export async function getEssenceArticles(limit = 6): Promise<ApiResult<ArticleItem[]>> {
  return fetchApi<ArticleItem[]>(`/api/article/essence${buildQs({ limit })}`)
}

/** 获取文章分类 */
export async function getArticleCategories(): Promise<ApiResult<ArticleCategory[]>> {
  return fetchApi<ArticleCategory[]>('/api/article/categories')
}

/** 获取我的文章 */
export async function getMyArticles(
  params: ArticleListParams = {},
): Promise<ApiResult<PageData<ArticleItem>>> {
  return fetchApi<PageData<ArticleItem>>(`/api/article/my${buildQs(params)}`)
}

/** 发布文章 */
export async function publishArticle(
  payload: Partial<ArticleItem>,
): Promise<ApiResult<ArticleItem>> {
  return fetchApi<ArticleItem>('/api/article/publish', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** 文章点赞 */
export async function likeArticle(id: string | number): Promise<ApiResult<void>> {
  return fetchApi<void>('/api/article/like', {
    method: 'POST',
    body: JSON.stringify({ id }),
  })
}

/** 文章收藏 */
export async function favoriteArticle(id: string | number): Promise<ApiResult<void>> {
  return fetchApi<void>('/api/article/favorite', {
    method: 'POST',
    body: JSON.stringify({ id }),
  })
}

/** 获取文章评论 */
export async function getArticleComments(
  id: string | number,
  query: PageQuery = {},
): Promise<ApiResult<PageData<unknown>>> {
  return fetchApi<PageData<unknown>>(`/api/article/comments${buildQs({ id, ...query })}`)
}

// ===================== content-generation（内容生成） =====================

/** 生成内容 */
export async function generateContent(
  params: ContentGenerationParams,
): Promise<ApiResult<ContentGenerationResult>> {
  return fetchApi<ContentGenerationResult>('/api/content-generation/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** 获取内容生成历史 */
export async function getContentGenerationHistory(
  query: PageQuery = {},
): Promise<ApiResult<PageData<ContentGenerationResult>>> {
  return fetchApi<PageData<ContentGenerationResult>>(
    `/api/content-generation/history${buildQs(query)}`,
  )
}

/** 内容生成模板列表 */
export async function getContentTemplates(): Promise<ApiResult<unknown[]>> {
  return fetchApi<unknown[]>('/api/content-generation/templates')
}

// ===================== docs（文档） =====================

/** 获取文档列表 */
export async function getDocsList(
  query: PageQuery & { category?: string; keyword?: string } = {},
): Promise<ApiResult<PageData<DocsItem>>> {
  return fetchApi<PageData<DocsItem>>(`/api/docs${buildQs(query)}`)
}

/** 获取文档详情 */
export async function getDocsDetail(slug: string): Promise<ApiResult<DocsItem>> {
  return fetchApi<DocsItem>(`/api/docs/${slug}`)
}

/** 获取文档分类 */
export async function getDocsCategories(): Promise<ApiResult<unknown[]>> {
  return fetchApi<unknown[]>('/api/docs/categories')
}

/** 创建文档 */
export async function createDocs(input: Partial<DocsItem>): Promise<ApiResult<DocsItem>> {
  return fetchApi<DocsItem>('/api/docs', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新文档 */
export async function updateDocs(
  slug: string,
  input: Partial<DocsItem>,
): Promise<ApiResult<DocsItem>> {
  return fetchApi<DocsItem>(`/api/docs/${slug}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除文档 */
export async function deleteDocs(slug: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/docs/${slug}`, { method: 'DELETE' })
}

// ===================== favorites（收藏） =====================

/** 获取收藏列表 */
export async function getFavorites(
  query: PageQuery & { resourceType?: string } = {},
): Promise<ApiResult<PageData<FavoriteItem>>> {
  return fetchApi<PageData<FavoriteItem>>(`/api/favorites${buildQs(query)}`)
}

/** 添加收藏 */
export async function addFavorite(input: {
  resourceType: string
  resourceId: string
}): Promise<ApiResult<FavoriteItem>> {
  return fetchApi<FavoriteItem>('/api/favorites', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 取消收藏 */
export async function removeFavorite(
  resourceType: string,
  resourceId: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/favorites/${resourceType}/${resourceId}`, {
    method: 'DELETE',
  })
}

/** 检查是否已收藏 */
export async function checkFavorite(
  resourceType: string,
  resourceId: string,
): Promise<ApiResult<{ favorited: boolean }>> {
  return fetchApi<{ favorited: boolean }>(`/api/favorites/check/${resourceType}/${resourceId}`)
}

// ===================== feedback（反馈） =====================

/** 提交反馈 */
export async function submitFeedback(input: {
  type: FeedbackType
  content: string
  contact?: string
  images?: string[]
}): Promise<ApiResult<Feedback>> {
  return fetchApi<Feedback>('/api/feedbacks', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 获取反馈列表 */
export async function getFeedbacks(
  query: PageQuery & { type?: FeedbackType; status?: FeedbackStatus } = {},
): Promise<ApiResult<PageData<Feedback>>> {
  return fetchApi<PageData<Feedback>>(`/api/feedbacks${buildQs(query)}`)
}

/** 获取反馈详情 */
export async function getFeedbackDetail(feedbackId: string): Promise<ApiResult<Feedback>> {
  return fetchApi<Feedback>(`/api/feedbacks/${feedbackId}`)
}

/** 回复反馈 */
export async function replyFeedback(
  feedbackId: string,
  reply: string,
): Promise<ApiResult<Feedback>> {
  return fetchApi<Feedback>(`/api/feedbacks/${feedbackId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ reply }),
  })
}

/** 更新反馈状态 */
export async function updateFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus,
): Promise<ApiResult<Feedback>> {
  return fetchApi<Feedback>(`/api/feedbacks/${feedbackId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

// ===================== search（搜索） =====================

/** 全局搜索 */
export async function search(
  query: PageQuery & { keyword?: string; type?: string } = {},
): Promise<ApiResult<PageData<SearchResult>>> {
  return fetchApi<PageData<SearchResult>>(`/api/search${buildQs(query)}`)
}

/** 获取搜索建议 */
export async function getSearchSuggestions(
  keyword: string,
): Promise<ApiResult<SearchSuggestion[]>> {
  return fetchApi<SearchSuggestion[]>(`/api/search/suggestions${buildQs({ keyword })}`)
}

/** 获取热搜词 */
export async function getHotSearchKeywords(limit = 10): Promise<ApiResult<string[]>> {
  return fetchApi<string[]>(`/api/search/hot-words${buildQs({ limit })}`)
}

/** 获取搜索历史 */
export async function getSearchHistory(
  query: PageQuery = {},
): Promise<ApiResult<PageData<string>>> {
  return fetchApi<PageData<string>>(`/api/search/history${buildQs(query)}`)
}

/** 清除搜索历史 */
export async function clearSearchHistory(): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/search/history', { method: 'DELETE' })
}

// ===================== share（分享） =====================

/** 创建分享 */
export async function createShare(input: {
  targetType?: string
  targetId?: string
  title?: string
  content?: string
  cover?: string
  expireAt?: string
}): Promise<ApiResult<ShareContent>> {
  return fetchApi<ShareContent>('/api/share', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 通过分享码获取分享内容 */
export async function getShareByCode(code: string): Promise<ApiResult<ShareContent>> {
  return fetchApi<ShareContent>(`/api/share/${code}`)
}

/** 获取我的分享列表 */
export async function getMyShares(
  query: PageQuery = {},
): Promise<ApiResult<PageData<ShareContent>>> {
  return fetchApi<PageData<ShareContent>>(`/api/share/my${buildQs(query)}`)
}

/** 删除分享 */
export async function deleteShare(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/share/${id}`, { method: 'DELETE' })
}
