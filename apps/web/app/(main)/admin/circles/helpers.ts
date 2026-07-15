import { fetchApi } from '@/lib/api'
import { ApiError } from '@/lib/api-error'
import type { Circle, CircleForm } from './types'

export const PAGE_SIZE = 10

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const EMPTY_FORM: CircleForm = {
  name: '',
  slug: '',
  description: '',
  coverImage: '',
  isPublished: true,
}

// TODO 后端对接: /api/admin/circles GET 列表端点尚未实现,以下为演示数据。
// 后端就绪后,删除 MOCK_CIRCLES 并改用 fetchCircles() 调用真实接口。
export const MOCK_CIRCLES: Circle[] = [
  {
    id: 'mock-1',
    name: '前端开发圈',
    slug: 'frontend-dev',
    description: '前端技术交流',
    coverImage: null,
    categoryId: null,
    memberCount: 128,
    postCount: 56,
    isPublished: true,
    createdBy: null,
    creatorName: '管理员',
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: 'mock-2',
    name: 'AI 探索者',
    slug: 'ai-explorers',
    description: 'AI 技术与应用讨论',
    coverImage: null,
    categoryId: null,
    memberCount: 256,
    postCount: 128,
    isPublished: true,
    createdBy: null,
    creatorName: '管理员',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'mock-3',
    name: '产品设计圈',
    slug: 'product-design',
    description: '产品与设计思维',
    coverImage: null,
    categoryId: null,
    memberCount: 64,
    postCount: 32,
    isPublished: false,
    createdBy: null,
    creatorName: '管理员',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
]

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new ApiError(r.error, r.status, r.errorCode)
  return r.data
}

export function circleToForm(item: Circle): CircleForm {
  return {
    name: item.name,
    slug: item.slug,
    description: item.description ?? '',
    coverImage: item.coverImage ?? '',
    isPublished: item.isPublished,
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
