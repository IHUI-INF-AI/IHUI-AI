// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// vi.mock 是 hoisted,所有 mock 工厂内的变量必须用 vi.hoisted 声明,否则 ReferenceError
const mocks = vi.hoisted(() => {
  // select() 查询构造器结果需兼容两种调用形态:
  //  - upsertItem / getCategoryIdBySlug 使用 `.where(...).limit(1)` 链式拼接
  //  - seedSeenTitlesFromDb 使用 `await db.select().from().where(...)` 直接取得 rows 后 for..of 遍历
  // 因此让每个环节(select/from/where/limit)都返回同一个数组(可迭代),任意一环 await 都得到 rows。
  // rows 同一对象既是可迭代数组(seedSeenTitlesFromDb 直接 await 遍历),
  // 又是链式查询构造器(upsertItem/getCategoryIdBySlug 走 .where().limit()),
  // 因此类型上同时声明数组与构造器方法。
  // 类型上用 any 以同时承载"可迭代数组 + 链式构造器"两种形态(纯测试桩,不追求类型安全)
  const rows: any = []
  rows.limit = vi.fn(() => rows)
  rows.where = vi.fn(() => rows)
  rows.from = vi.fn(() => rows)

  const mockSelect = vi.fn(() => rows)
  const mockFrom = rows.from
  const mockWhere = rows.where
  const mockLimit = rows.limit

  const mockOnConflictDoNothing = vi.fn(() => undefined)
  const mockReturning = vi.fn(() => [])
  const mockValues = vi.fn(() => ({
    onConflictDoNothing: mockOnConflictDoNothing,
    returning: mockReturning,
  }))
  const mockInsert = vi.fn(() => ({ values: mockValues }))

  const mockUpdateWhere = vi.fn(() => undefined)
  const mockSet = vi.fn(() => ({ where: mockUpdateWhere }))
  const mockUpdate = vi.fn(() => ({ set: mockSet }))

  return {
    mockSelect,
    mockInsert,
    mockUpdate,
    mockLimit,
    mockWhere,
    mockFrom,
    mockValues,
    mockReturning,
    mockOnConflictDoNothing,
    mockSet,
    mockUpdateWhere,
  }
})

vi.mock('../../db/index.js', () => ({
  db: {
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
  },
}))

vi.mock('@ihui/database', () => ({
  aiWorldCategories: {
    id: 'id',
    slug: 'slug',
    name: 'name',
    description: 'description',
    icon: 'icon',
    sort: 'sort',
    status: 'status',
  },
  aiWorldItems: {
    id: 'id',
    kind: 'kind',
    sourceUrl: 'source_url',
    title: 'title',
    summary: 'summary',
    content: 'content',
    url: 'url',
    coverImage: 'cover_image',
    publishedAt: 'published_at',
    fetchedAt: 'fetched_at',
    metadata: 'metadata',
    status: 'status',
    updatedAt: 'updated_at',
    likeCount: 'like_count',
    viewCount: 'view_count',
    categoryId: 'category_id',
    source: 'source',
    trendingScore: 'trending_score',
    trendingMetrics: 'trending_metrics',
    trendingUpdatedAt: 'trending_updated_at',
  },
  aiWorldSyncLog: {
    source: 'source',
    kind: 'kind',
    status: 'status',
    startedAt: 'started_at',
    finishedAt: 'finished_at',
    itemCount: 'item_count',
    error: 'error',
  },
  aiWorldRankings: {
    id: 'id',
    leaderboard: 'leaderboard',
    category: 'category',
    rank: 'rank',
    modelName: 'model_name',
    provider: 'provider',
    score: 'score',
    scores: 'scores',
    metadata: 'metadata',
    publishedAt: 'published_at',
    fetchedAt: 'fetched_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}))

// Import after mocks are in place
import {
  AI_WORLD_CATEGORIES,
  syncAllSources,
  syncRankings,
  runDryRun,
  getSourceStats,
  dedupKeyOf,
  type FetchedItem,
  type LeaderboardEntry,
  type LeaderboardId,
} from '../ai-world-sync.js'

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
    const forbiddenSlugs = [
      'ai-writing-tools',
      'ai-chatbots',
      'ai-image-tools',
      'ai-video-tools',
      'ai-programming-tools',
    ]
    for (const cat of AI_WORLD_CATEGORIES) {
      expect(forbiddenSlugs).not.toContain(cat.slug)
    }
  })
})

describe('AI World Sync — 信源数量(深度打磨后)', () => {
  it('getSourceStats 应返回国内外全覆盖的信源数量', () => {
    const stats = getSourceStats()
    // RSS: 11 国外官方 + 9 国外媒体 + 5 国内媒体 = 25(2026-09-05 深度根治剔除死源后口径)
    // 断言用下限 + 与总数组一致,避免绑定到会随源增删而变动的绝对数。
    expect(stats.rss).toBeGreaterThanOrEqual(25)
    // arXiv 分类:6
    expect(stats.arxiv).toBeGreaterThanOrEqual(6)
    // GitHub topics:12
    expect(stats.github).toBeGreaterThanOrEqual(12)
    // AI Apps:35+
    expect(stats.apps).toBeGreaterThanOrEqual(35)
    // AI Tools:35+
    expect(stats.tools).toBeGreaterThanOrEqual(35)
    // 总源数:rss(25) + 1(arxiv) + 1(hf papers) + 12(github topics) + 35(apps) + 35(tools) + 5(rankings) + 8(trending) ≈ 122
    expect(stats.total).toBeGreaterThanOrEqual(stats.rss)
    expect(stats.total).toBeGreaterThanOrEqual(100)
  })

  it('getSourceStats 应包含 rankings 和 trending 字段(2026-07-22 新增)', () => {
    const stats = getSourceStats()
    // rankings:5 大权威榜单(lmsys / opencompass / hf-open-llm / superclue / artificial-analysis)
    expect(stats.rankings).toBeGreaterThanOrEqual(5)
    // trending:有 GitHub 仓库的 AI 工具/APP(8 个)
    expect(stats.trending).toBeGreaterThanOrEqual(5)
    // total 应包含 rankings + trending 贡献(原有 6 类源基数 ≈114 + rankings 5 + trending 8 → >= 120)
    // 注:stats.arxiv 是分类数(6),total 公式中 arxiv 只算 1 个源,故不直接相加
    expect(stats.total).toBeGreaterThanOrEqual(120)
  })
})

describe('AI World Sync — 同步主流程', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('syncAllSources 应返回 SyncSourceResult[] 数组,支持 success/partial/failed 三态', async () => {
    const originalFetch = globalThis.fetch
    // mock fetch 返回空数据(不阻塞流程,所有源走 success 但 itemCount=0)
    globalThis.fetch = vi.fn(
      async () =>
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
        expect(['success', 'failed', 'partial']).toContain(r.status)
        expect(typeof r.itemCount).toBe('number')
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  }, 120000)

  it('syncAllSources 应覆盖所有 kind 类型(news/paper/project/tool/app)', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ) as unknown as typeof fetch

    try {
      const results = await syncAllSources()
      const kinds = new Set(results.map((r) => r.kind))
      // 至少覆盖 4 种 kind(app/tool/news/paper/project)
      expect(kinds.size).toBeGreaterThanOrEqual(4)
      expect(kinds.has('news')).toBe(true)
      expect(kinds.has('paper')).toBe(true)
      expect(kinds.has('app')).toBe(true)
      expect(kinds.has('tool')).toBe(true)
    } finally {
      globalThis.fetch = originalFetch
    }
  }, 120000)
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

  it('FetchedItem 支持可选 categorySlug 用于分类自动关联', () => {
    const item: FetchedItem = {
      kind: 'app',
      source: 'chatgpt',
      sourceUrl: 'https://chat.openai.com',
      title: 'ChatGPT',
      categorySlug: 'chat',
    }
    expect(item.categorySlug).toBe('chat')
  })
})

describe('AI World Sync — 模型排行榜(2026-07-22 新增)', () => {
  it('LeaderboardEntry 类型契约:5 种 leaderboard id,必填字段齐全', () => {
    const validIds: LeaderboardId[] = [
      'lmsys',
      'opencompass',
      'hf-open-llm',
      'superclue',
      'artificial-analysis',
    ]
    expect(validIds).toHaveLength(5)
    for (const leaderboard of validIds) {
      const entry: LeaderboardEntry = {
        leaderboard,
        category: 'overall',
        rank: 1,
        modelName: 'Test Model',
        provider: 'test-provider',
        score: '1200',
        scores: { elo: 1200, votes: 1000 },
        publishedAt: new Date(),
      }
      expect(entry.leaderboard).toBe(leaderboard)
      expect(entry.category).toBe('overall')
      expect(entry.rank).toBeGreaterThan(0)
      expect(entry.modelName).toBeTruthy()
    }
  })

  it('syncRankings 应返回 SyncSourceResult[] 数组,失败不阻塞(mock fetch 返回空 HTML)', async () => {
    const originalFetch = globalThis.fetch
    // mock fetch 返回空 HTML(模拟 JS 渲染页面拿不到表格,所有榜单返回空数组但 success)
    globalThis.fetch = vi.fn(
      async () =>
        new Response('<html><body></body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }),
    ) as unknown as typeof fetch

    try {
      const results = await syncRankings()
      expect(Array.isArray(results)).toBe(true)
      // 5 大榜单各返回一个 SyncSourceResult
      expect(results.length).toBe(5)
      for (const r of results) {
        expect(r).toHaveProperty('source')
        expect(r).toHaveProperty('kind')
        expect(r.kind).toBe('ranking')
        expect(['success', 'failed', 'partial']).toContain(r.status)
        expect(typeof r.itemCount).toBe('number')
        // 空数据视为 success(不阻塞),itemCount=0
        expect(r.status).toBe('success')
        expect(r.itemCount).toBe(0)
      }
      // 验证 5 个榜单 source 都在结果中
      const sources = new Set(results.map((r) => r.source))
      expect(sources.has('lmsys')).toBe(true)
      expect(sources.has('opencompass')).toBe(true)
      expect(sources.has('hf-open-llm')).toBe(true)
      expect(sources.has('superclue')).toBe(true)
      expect(sources.has('artificial-analysis')).toBe(true)
    } finally {
      globalThis.fetch = originalFetch
    }
  }, 60000)

  it('syncRankings 应对每个榜单写同步日志(writeSyncLog 调 db.insert)', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(
      async () =>
        new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }),
    ) as unknown as typeof fetch

    try {
      vi.clearAllMocks()
      await syncRankings()
      // 5 个榜单各写一条 sync log → db.insert 至少被调用 5 次
      expect(mocks.mockInsert).toHaveBeenCalled()
      expect(mocks.mockInsert.mock.calls.length).toBeGreaterThanOrEqual(5)
    } finally {
      globalThis.fetch = originalFetch
    }
  }, 60000)
})

describe('AI World Sync — Dry-run 模式(2026-07-22 新增)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runDryRun 应返回预计条目数数组,不写库(db.insert/update 未被调用)', async () => {
    const originalFetch = globalThis.fetch
    // mock fetch 返回空 HTML/JSON,所有 fetcher 返回空或抛错(被 runDryRun try/catch 捕获)
    globalThis.fetch = vi.fn(
      async () =>
        new Response('<html><body></body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }),
    ) as unknown as typeof fetch

    try {
      const results = await runDryRun()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
      for (const r of results) {
        expect(r).toHaveProperty('source')
        expect(r).toHaveProperty('kind')
        expect(r).toHaveProperty('estimatedItems')
        expect(typeof r.estimatedItems).toBe('number')
      }
      // dry-run 不写库:db.insert 和 db.update 都不应被调用
      expect(mocks.mockInsert).not.toHaveBeenCalled()
      expect(mocks.mockUpdate).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
    }
  }, 120000)

  it('runDryRun 应覆盖所有数据源类型(rss/paper/project/app/tool/ranking/trending)', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(
      async () =>
        new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }),
    ) as unknown as typeof fetch

    try {
      const results = await runDryRun()
      const kinds = new Set(results.map((r) => r.kind))
      // 至少覆盖 ranking + trending(2026-07-22 新增类型)
      expect(kinds.has('ranking')).toBe(true)
      expect(kinds.has('trending')).toBe(true)
      // 5 大排行榜 source 全覆盖
      const rankingSources = results.filter((r) => r.kind === 'ranking').map((r) => r.source)
      expect(rankingSources).toContain('lmsys')
      expect(rankingSources).toContain('opencompass')
      expect(rankingSources).toContain('hf-open-llm')
      expect(rankingSources).toContain('superclue')
      expect(rankingSources).toContain('artificial-analysis')
    } finally {
      globalThis.fetch = originalFetch
    }
  }, 120000)
})

describe('AI World Sync — dedupKeyOf 标题归一化去重', () => {
  it('同一标题不同来源转载（标点/大小写差异）收敛为同一去重键', () => {
    // 同文转载：标点、空格、大小写变化都归一到同一键
    expect(dedupKeyOf('news', 'Introducing GPT-5: The Future')).toBe(
      dedupKeyOf('news', ' Introducing GPT 5 the future!! '),
    )
    // 全角标点（中文全角冒号/逗号）与半角混排也应收敛
    expect(dedupKeyOf('news', 'GPT-5：重磅发布，开创未来')).toBe(
      dedupKeyOf('news', 'GPT5 重磅发布,开创未来'),
    )
    expect(dedupKeyOf('news', 'GPT-5：重磅发布，开创未来')).toBe(dedupKeyOf('news', 'GPT5重磅发布开创未来'))
  })

  it('全角空格/字母全角化经 NFKC 归一到半角', () => {
    // A＋B 中 B 是全角,NFKC → A+B;B 前是全角空格( U+3000)
    expect(dedupKeyOf('tool', 'ChatGPT\u3000４').endsWith('chatgpt4')).toBe(true)
    expect(dedupKeyOf('tool', 'ChatGPT 4')).toBe(dedupKeyOf('tool', 'ChatGPT\u3000４'))
  })

  it('零宽连接符/零宽空格/BOM 剔除后判为重复', () => {
    const plain = dedupKeyOf('app', 'Kimi智能助手')
    expect(dedupKeyOf('app', 'Kimi\u200b智能\u200c助手')).toBe(plain) // 零宽空格 + 零宽连接符
    expect(dedupKeyOf('app', '\uFEFFKimi智能助手')).toBe(plain) // BOM
    expect(dedupKeyOf('app', 'Kimi\u2060智能助手')).toBe(plain) // word joiner
  })

  it('kind 命名空间隔离同名标题', () => {
    const a = dedupKeyOf('news', 'GPT-5')
    const b = dedupKeyOf('app', 'GPT-5')
    expect(a).not.toBe(b)
    expect(a).toBe('news::gpt5')
    expect(b).toBe('app::gpt5')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
