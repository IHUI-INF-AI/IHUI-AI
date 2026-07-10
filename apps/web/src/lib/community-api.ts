import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

export interface Circle {
  id: string
  name: string
  cover: string | null
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
  cover: string | null
  content: string
  author: string
  category: string
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
  return fetchApi<{ circle: Circle; posts: CirclePost[] }>(
    `/circles/${encodeURIComponent(id)}`,
  )
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

export async function getAsks(
  query: AskListQuery = {},
): Promise<ApiResult<PageData<Ask>>> {
  return fetchApi<PageData<Ask>>(`/asks${buildQs(query)}`)
}

export async function getAskById(
  id: string,
): Promise<ApiResult<{ ask: Ask; answers: unknown[] }>> {
  return fetchApi<{ ask: Ask; answers: unknown[] }>(`/asks/${encodeURIComponent(id)}`)
}

export async function createAsk(input: {
  title: string
  content: string
  tags?: string[]
}): Promise<ApiResult<Ask>> {
  return fetchApi<Ask>('/asks', { method: 'POST', body: JSON.stringify(input) })
}

export async function getTopics(
  query: { page?: number; pageSize?: number } = {},
): Promise<ApiResult<PageData<Topic>>> {
  return fetchApi<PageData<Topic>>(`/topics${buildQs(query)}`)
}

export async function getNews(
  query: NewsListQuery = {},
): Promise<ApiResult<PageData<News>>> {
  return fetchApi<PageData<News>>(`/news${buildQs(query)}`)
}

export async function getNewsById(id: string): Promise<ApiResult<News>> {
  return fetchApi<News>(`/news/${encodeURIComponent(id)}`)
}
