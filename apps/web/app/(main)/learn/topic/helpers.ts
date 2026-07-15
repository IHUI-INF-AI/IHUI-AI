import { fetchApi } from '@/lib/api'

export interface TopicLesson {
  id: string
  title: string
  name?: string
  coverImage?: string
  image?: string
  cover?: string
  intro?: string
  instructor?: string
  price?: string | number
  originalPrice?: string | number | null
  isFree?: boolean
}
export interface TopicDetail {
  id: string
  title: string
  coverImage?: string
  image?: string
  description?: string
  lessonIds?: string[]
  learnNum?: number
  price?: number | string
  originalPrice?: number | string | null
  lessonList?: TopicLesson[]
  lessons?: TopicLesson[]
}
export type TopicSource = 'lesson' | 'premium'

export interface LoadedTopic {
  source: TopicSource
  topic: TopicDetail
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export async function loadTopic(id: string): Promise<LoadedTopic> {
  try {
    const r = await api<{ topic: TopicDetail }>(`/api/topics/${id}`)
    return { source: 'lesson', topic: r.topic }
  } catch (lessonErr) {
    const r = await api<TopicDetail>(`/api/learn/topics/${id}`)
    if (r && 'error' in r) throw lessonErr
    return { source: 'premium', topic: r }
  }
}

export async function fetchPremiumLessons(id: string): Promise<TopicLesson[]> {
  const r = await api<TopicLesson[]>(`/api/learn/topics/${id}/lessons`)
  return Array.isArray(r) ? r : ((r as { list?: TopicLesson[] }).list ?? [])
}
