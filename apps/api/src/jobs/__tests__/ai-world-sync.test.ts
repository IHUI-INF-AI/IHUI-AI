import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// vi.mock 是 hoisted,所有 mock 工厂内的变量必须用 vi.hoisted 声明,否则 ReferenceError
const mocks = vi.hoisted(() => {
  const mockLimit = vi.fn(() => [])
  const mockWhere = vi.fn(() => ({ limit: mockLimit }))
  const mockFrom = vi.fn(() => ({ where: mockWhere }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))

  const mockOnConflictDoNothing = vi.fn(() => undefined)
  const mockReturning = vi.fn(() => [])
  const mockValues = vi.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing, returning: mockReturning }))
  const mockInsert = vi.fn(() => ({ values: mockValues }))

  const mockUpdateWhere = vi.fn(() => undefined)
  const mockSet = vi.fn(() => ({ where: mockUpdateWhere }))
  const mockUpdate = vi.fn(() => ({ set: mockSet }))

  return { mockSelect, mockInsert, mockUpdate, mockLimit, mockWhere, mockFrom, mockValues, mockReturning, mockOnConflictDoNothing, mockSet, mockUpdateWhere }
})

vi.mock('../../db/index.js', () => ({
  db: {
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
  },
}))

vi.mock('@ihui/database', () => ({
  aiWorldCategories: { id: 'id', slug: 'slug', name: 'name', description: 'description', icon: 'icon', sort: 'sort', status: 'status' },
  aiWorldItems: { id: 'id', kind: 'kind', sourceUrl: 'source_url', title: 'title', summary: 'summary', content: 'content', url: 'url', coverImage: 'cover_image', publishedAt: 'published_at', fetchedAt: 'fetched_at', metadata: 'metadata', status: 'status', updatedAt: 'updated_at', likeCount: 'like_count', viewCount: 'view_count', categoryId: 'category_id' },
  aiWorldSyncLog: { source: 'source', kind: 'kind', status: 'status', startedAt: 'started_at', finishedAt: 'finished_at', itemCount: 'item_count', error: 'error' },
}))

// Import after mocks are in place
import { AI_WORLD_CATEGORIES, syncAllSources, type FetchedItem } from '../ai-world-sync.js'

describe('AI World Sync — 数据完整性', () => {
  it('AI_WORLD_CATEGORIES 应有 12 个分类', () => {
    expect(AI_WORLD_CATEGORIES).toHaveLength(12)
  })

  it('每个分类都有 slug/name/description/icon/sort 且 slug 唯一', () => {
    const slugs = new Set<string>()
    for (const cat of AI_WORLD_CATEGORIES) {
      expect(cat.slug).toBeTruthy()
      expect(cat.name).toBeTruthy()
      expect(cat.description).toBeTruthy()
      expect(cat.icon).toBeTruthy()
      expect(cat.sort).toBeGreaterThan(0)
      expect(slugs.has(cat.slug)).toBe(false)
      slugs.add(cat.slug)
    }
  })

  it('分类 sort 值应连续递增 1-12', () => {
    const sorted = [...AI_WORLD_CATEGORIES].sort((a, b) => a.sort - b.sort)
    sorted.forEach((cat, i) => {
      expect(cat.sort).toBe(i + 1)
    })
  })

  it('不包含 ai-bot.cn 的英文 slug 命名(反抄袭边界)', () => {
    const forbiddenSlugs = ['ai-writing-tools', 'ai-chatbots', 'ai-image-tools', 'ai-video-tools', 'ai-programming-tools']
    for (const cat of AI_WORLD_CATEGORIES) {
      expect(forbiddenSlugs).not.toContain(cat.slug)
    }
  })
})

describe('AI World Sync — 同步主流程', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('syncAllSources 应返回 SyncSourceResult[] 数组(每项含 source/kind/status/itemCount)', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch

    try {
      const results = await syncAllSources()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
      for (const r of results) {
        expect(r).toHaveProperty('source')
        expect(r).toHaveProperty('kind')
        expect(['success', 'failed']).toContain(r.status)
        expect(typeof r.itemCount).toBe('number')
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  }, 60000)
})

describe('AI World Sync — FetchedItem 类型契约', () => {
  it('FetchedItem 必须有 kind/source/sourceUrl/title 四个必填字段', () => {
    const item: FetchedItem = {
      kind: 'news',
      source: 'openai',
      sourceUrl: 'https://openai.com/blog/abc',
      title: 'Test',
    }
    expect(item.kind).toBe('news')
    expect(item.source).toBe('openai')
    expect(item.sourceUrl).toBeTruthy()
    expect(item.title).toBe('Test')
  })

  it('所有 kind 值都在 5 种以内(news/paper/project/tool/app)', () => {
    const validKinds = ['news', 'paper', 'project', 'tool', 'app'] as const
    for (const kind of validKinds) {
      const item: FetchedItem = {
        kind,
        source: 'test',
        sourceUrl: 'https://example.com',
        title: 'Test',
      }
      expect(item.kind).toBe(kind)
    }
  })
})
