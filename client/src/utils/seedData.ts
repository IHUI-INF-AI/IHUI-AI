/**
 * P14.4 种子数据 fetcher
 * 拉取 public/mock-data/*.json,提供分页/搜索/过滤能力
 * 当后端不可用时作为 fallback,保证 admin 前端始终有数据可演示
 */

export type SeedListResp<T> = {
  code: 0
  msg: 'success'
  data: {
    list: T[]
    total: number
    page: number
    size: number
  }
  timestamp: number
}

const BASE = '/mock-data'

async function loadAll<T = any>(name: string): Promise<T[]> {
  const res = await fetch(`${BASE}/${name}.json`)
  if (!res.ok) return []
  return res.json()
}

/** 通用分页查询 */
export async function querySeed<T = any>(
  name: string,
  opts: { page?: number; size?: number; keyword?: string; filter?: (it: T) => boolean } = {}
): Promise<SeedListResp<T>> {
  const { page = 1, size = 20, keyword = '', filter } = opts
  const all = await loadAll<T>(name)
  let list = all
  if (filter) list = list.filter(filter)
  if (keyword) {
    const kw = keyword.toLowerCase()
    list = list.filter((it) => JSON.stringify(it).toLowerCase().includes(kw))
  }
  const total = list.length
  const start = (page - 1) * size
  return {
    code: 0,
    msg: 'success',
    data: { list: list.slice(start, start + size), total, page, size },
    timestamp: Date.now(),
  }
}

/** 单条查询 */
export async function getSeed<T = any>(name: string, id: number | string): Promise<T | null> {
  const all = await loadAll<T>(name)
  return all.find((it: any) => it.id === id || it.id === Number(id)) || null
}

/** 配置类单对象查询 */
export async function getConfig<T = any>(name: string): Promise<T | null> {
  const res = await fetch(`${BASE}/${name}.json`)
  if (!res.ok) return null
  return res.json()
}

export const SEED_NAMES = [
  'users', 'courses', 'orders', 'exams', 'activities', 'faqs', 'announcements',
  'lives', 'asks', 'circles', 'articles', 'comments', 'news', 'resources',
  'points', 'certificates', 'roles', 'authorities', 'searchHots', 'carousels',
] as const

/**
 * P15.1 体系 B fallback:返回 { success, data: { list, total } } 格式
 * 供 admin-orders / admin-products / admin-faq / admin-agents / admin-activities 使用
 */
export async function seedFallbackB(
  seedName: string,
  params: { page?: number; pageSize?: number; current?: number; size?: number; keyword?: string } = {}
): Promise<{ success: boolean; code: number; data: { list: any[]; total: number }; message: string; timestamp: number }> {
  const { page, pageSize, current, size, keyword = '' } = params
  const p = page || current || 1
  const s = pageSize || size || 20
  const result = await querySeed(seedName, { page: p, size: s, keyword })
  return {
    success: true,
    code: 0,
    data: { list: result.data.list, total: result.data.total },
    message: 'success (seed fallback)',
    timestamp: Date.now(),
  }
}
