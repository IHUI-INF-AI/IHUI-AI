import type { ApiResult } from '@ihui/types'
import { fetchApi } from '@/lib/api'
import { buildQs } from '@/lib/edu'
import { getCategories as getSystemCategories } from './system-api'
import { getCategories as getCourseCategories } from './course-api'

export type CategoryType =
  'lesson' | 'live' | 'article' | 'ask' | 'circle' | 'resource' | 'exam' | 'news'

export interface CategoryNode {
  id: string
  name: string
  type: string
  parentId: string | null
  sort: number
  children?: CategoryNode[]
}

const CACHE_TTL = 10 * 60 * 1000
const cache = new Map<string, { data: CategoryNode[]; ts: number }>()

export async function getAllCategories(
  types: CategoryType[] = [
    'lesson',
    'live',
    'article',
    'ask',
    'circle',
    'resource',
    'exam',
    'news',
  ],
  forceRefresh = false,
): Promise<Record<CategoryType, CategoryNode[]>> {
  const now = Date.now()
  const result = {} as Record<CategoryType, CategoryNode[]>

  await Promise.all(
    types.map(async (type) => {
      const cached = cache.get(type)
      if (!forceRefresh && cached && now - cached.ts < CACHE_TTL) {
        result[type] = cached.data
        return
      }
      const res =
        type === 'lesson' ? await getCourseCategories() : await getSystemCategories({ type })
      const list = (res.success ? res.data : []) as CategoryNode[]
      cache.set(type, { data: list, ts: now })
      result[type] = list
    }),
  )

  return result
}

export async function getCategoryTreeByType(
  type: CategoryType,
  forceRefresh = false,
): Promise<ApiResult<CategoryNode[]>> {
  const cached = cache.get(type)
  if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL) {
    return { success: true, data: cached.data } as ApiResult<CategoryNode[]>
  }
  const res = await fetchApi<CategoryNode[]>(`/api/categories/tree${buildQs({ type })}`)
  if (res.success && res.data) {
    cache.set(type, { data: res.data, ts: Date.now() })
  }
  return res
}

export function clearCategoryCache(type?: CategoryType): void {
  if (type) {
    cache.delete(type)
  } else {
    cache.clear()
  }
}
