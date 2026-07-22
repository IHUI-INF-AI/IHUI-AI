import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'

export interface Circle {
  id: string
  name: string
  coverImage: string | null
  description: string
  memberCount: number
  postCount: number
  isJoined: boolean
  owner: { id: string; nickname: string; avatar: string | null }
  createdAt: string
}

export interface CirclePost {
  id: string
  circleId: string
  title: string
  content: string
  images: string[]
  author: { id: string; nickname: string; avatar: string | null }
  likeCount: number
  commentCount: number
  isLiked: boolean
  createdAt: string
}

export interface Ask {
  id: string
  title: string
  content: string
  author: { id: string; nickname: string; avatar: string | null }
  answerCount: number
  viewCount: number
  isResolved: boolean
  tags: string[]
  createdAt: string
}

export interface Topic {
  id: string
  name: string
  description: string
  postCount: number
  followerCount: number
  isFollowed: boolean
  createdAt: string
}

export interface News {
  id: string
  title: string
  summary: string
  coverImage: string | null
  authorName: string | null
  categoryName: string | null
  content: string
  viewCount: number
  likeCount: number
  isLiked: boolean
  publishedAt: string
}

export type CircleListQuery = {
  page?: number
  pageSize?: number
  keyword?: string
}

export type AskListQuery = {
  page?: number
  pageSize?: number
  keyword?: string
  isResolved?: string
}

export type NewsListQuery = {
  page?: number
  pageSize?: number
  category?: string
  keyword?: string
}

export async function getCircles(
  query: CircleListQuery = {},
): Promise<ApiResult<PageData<Circle>>> {
  return fetchApi<PageData<Circle>>(`/circles${buildQs(query)}`)
}

export async function getCircleById(
  id: string,
): Promise<ApiResult<{ circle: Circle; posts: CirclePost[] }>> {
  return fetchApi<{ circle: Circle; posts: CirclePost[] }>(`/circles/${encodeURIComponent(id)}`)
}

export async function createCirclePost(
  circleId: string,
  input: { title: string; content: string; images?: string[] },
): Promise<ApiResult<CirclePost>> {
  return fetchApi<CirclePost>(`/circles/${encodeURIComponent(circleId)}/posts`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getAsks(query: AskListQuery = {}): Promise<ApiResult<PageData<Ask>>> {
  return fetchApi<PageData<Ask>>(`/asks${buildQs(query)}`)
}

export async function getAskById(id: string): Promise<ApiResult<{ ask: Ask; answers: unknown[] }>> {
  return fetchApi<{ ask: Ask; answers: unknown[] }>(`/asks/${encodeURIComponent(id)}`)
}

export async function createAsk(input: {
  title: string
  content: string
  tags?: string[]
}): Promise<ApiResult<Ask>> {
  return fetchApi<Ask>('/asks', { method: 'POST', body: JSON.stringify(input) })
}

export async function updateAsk(
  id: string,
  input: { title: string; content: string; tags?: string[] },
): Promise<ApiResult<Ask>> {
  return fetchApi<Ask>(`/asks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteAsk(id: string): Promise<ApiResult<void>> {
  return fetchApi<void>(`/asks/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export interface AskAnswer {
  id: string
  askId: string
  content: string
  author: { id: string; nickname: string; avatar: string | null }
  likeCount: number
  isLiked: boolean
  createdAt: string
}

export async function getAnswers(
  askId: string,
  query: { page?: number; pageSize?: number } = {},
): Promise<ApiResult<PageData<AskAnswer>>> {
  return fetchApi<PageData<AskAnswer>>(
    `/asks/${encodeURIComponent(askId)}/answers${buildQs(query)}`,
  )
}

export async function createAnswer(
  askId: string,
  input: { content: string },
): Promise<ApiResult<AskAnswer>> {
  return fetchApi<AskAnswer>(`/asks/${encodeURIComponent(askId)}/answers`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateAnswer(
  answerId: string,
  input: { content: string },
): Promise<ApiResult<AskAnswer>> {
  return fetchApi<AskAnswer>(`/asks/answers/${encodeURIComponent(answerId)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteAnswer(answerId: string): Promise<ApiResult<void>> {
  return fetchApi<void>(`/asks/answers/${encodeURIComponent(answerId)}`, { method: 'DELETE' })
}

export async function getMyAsks(
  query: { page?: number; pageSize?: number } = {},
): Promise<ApiResult<PageData<Ask>>> {
  return fetchApi<PageData<Ask>>(`/asks/my${buildQs(query)}`)
}

export async function getMyAnswers(
  query: { page?: number; pageSize?: number } = {},
): Promise<ApiResult<PageData<AskAnswer>>> {
  return fetchApi<PageData<AskAnswer>>(`/asks/my/answers${buildQs(query)}`)
}

export async function getAsksByIds(ids: string[]): Promise<ApiResult<Ask[]>> {
  return fetchApi<Ask[]>(`/asks/by-ids${buildQs({ ids: ids.join(',') })}`)
}

export async function getAnswersByIds(ids: string[]): Promise<ApiResult<AskAnswer[]>> {
  return fetchApi<AskAnswer[]>(`/asks/answers/by-ids${buildQs({ ids: ids.join(',') })}`)
}

export async function countMyQuestions(): Promise<ApiResult<number>> {
  return fetchApi<number>('/asks/my/count')
}

export async function countMyAnswers(): Promise<ApiResult<number>> {
  return fetchApi<number>('/asks/my/answers/count')
}

export async function getTopics(
  query: { page?: number; pageSize?: number } = {},
): Promise<ApiResult<PageData<Topic>>> {
  return fetchApi<PageData<Topic>>(`/topics${buildQs(query)}`)
}

export async function getNews(query: NewsListQuery = {}): Promise<ApiResult<PageData<News>>> {
  return fetchApi<PageData<News>>(`/news/articles${buildQs(query)}`)
}

export async function getNewsById(id: string): Promise<ApiResult<News>> {
  return fetchApi<News>(`/news/articles/${encodeURIComponent(id)}`)
}

/** 批量查询资源点赞数 */
export async function getLikeCounts(
  resourceType: string,
  resourceIds: string[],
): Promise<ApiResult<LikeCountItem[]>> {
  return fetchApi<LikeCountItem[]>('/behavior/likes/counts', {
    method: 'POST',
    body: JSON.stringify({ resourceType, resourceIds }),
  })
}

export interface LikeCountItem {
  resourceId: string
  count: number
}
