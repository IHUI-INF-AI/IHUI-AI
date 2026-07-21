import { createDb } from '../src/client.js'
import { aiFeedSource } from '../src/schema/ai-feed.js'
import { eq } from 'drizzle-orm'

const db = createDb(
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui',
)

/**
 * AI 资讯信源种子数据(参考 aihot.virxact.com/all 信源结构)。
 *
 * 三类信源:
 * 1. hotlist(国内 8 + 国外 4):走 DailyHotApi(/news/<platform> 相对路径)
 * 2. rss(厂商博客 5):走 RSSHub(/<route> 相对路径)
 *
 * fetchIntervalMinutes 默认 360(6 小时),与 cron `0 */6 * * *` 对齐。
 * 幂等 upsert:已存在则只更新可变字段,不重置 enabled/lastFetchAt/lastFetchStatus。
 */

interface SourceSeed {
  sourceCode: string
  sourceName: string
  sourceType: 'hotlist' | 'rss' | 'api'
  endpoint: string
  category: 'general' | 'ai-media' | 'ai-paper' | 'tech-community'
  icon: string | null
  color: string | null
  sortOrder: number
  description: string | null
}

const sources: SourceSeed[] = [
  // ===== 国内 hotlist(DailyHotApi,8 个)=====
  {
    sourceCode: 'weibo',
    sourceName: '微博热搜',
    sourceType: 'hotlist',
    endpoint: '/news/weibo',
    category: 'general',
    icon: 'weibo',
    color: '#E6162D',
    sortOrder: 1,
    description: '微博实时热搜榜(AI 相关条目)',
  },
  {
    sourceCode: 'zhihu',
    sourceName: '知乎热榜',
    sourceType: 'hotlist',
    endpoint: '/news/zhihu',
    category: 'general',
    icon: 'zhihu',
    color: '#0084FF',
    sortOrder: 2,
    description: '知乎热门话题(AI 相关条目)',
  },
  {
    sourceCode: '36kr',
    sourceName: '36氪',
    sourceType: 'hotlist',
    endpoint: '/news/36kr',
    category: 'general',
    icon: '36kr',
    color: '#0061FE',
    sortOrder: 3,
    description: '36氪科技快讯(AI 行业动态)',
  },
  {
    sourceCode: 'sspai',
    sourceName: '少数派',
    sourceType: 'hotlist',
    endpoint: '/news/sspai',
    category: 'tech-community',
    icon: 'sspai',
    color: '#D33A31',
    sortOrder: 4,
    description: '少数派热门文章(AI 工具与实践)',
  },
  {
    sourceCode: 'juejin',
    sourceName: '掘金',
    sourceType: 'hotlist',
    endpoint: '/news/juejin',
    category: 'tech-community',
    icon: 'juejin',
    color: '#1E80FF',
    sortOrder: 5,
    description: '掘金技术热榜(AI 编程与算法)',
  },
  {
    sourceCode: 'v2ex',
    sourceName: 'V2EX',
    sourceType: 'hotlist',
    endpoint: '/news/v2ex',
    category: 'tech-community',
    icon: 'v2ex',
    color: '#333333',
    sortOrder: 6,
    description: 'V2EX 创意工作者社区(AI 话题)',
  },
  {
    sourceCode: 'bilibili',
    sourceName: '哔哩哔哩',
    sourceType: 'hotlist',
    endpoint: '/news/bilibili',
    category: 'general',
    icon: 'bilibili',
    color: '#FB7299',
    sortOrder: 7,
    description: 'B站热门视频(AI 教程与资讯)',
  },
  {
    sourceCode: 'ithome',
    sourceName: 'IT之家',
    sourceType: 'hotlist',
    endpoint: '/news/ithome',
    category: 'ai-media',
    icon: 'ithome',
    color: '#DA251D',
    sortOrder: 8,
    description: 'IT之家热门资讯(AI 板块)',
  },

  // ===== 国外 hotlist(DailyHotApi,4 个)=====
  {
    sourceCode: 'hackernews',
    sourceName: 'Hacker News',
    sourceType: 'hotlist',
    endpoint: '/news/hackernews',
    category: 'tech-community',
    icon: 'hackernews',
    color: '#FF6600',
    sortOrder: 11,
    description: 'Y Combinator Hacker News 热门',
  },
  {
    sourceCode: 'producthunt',
    sourceName: 'Product Hunt',
    sourceType: 'hotlist',
    endpoint: '/news/producthunt',
    category: 'general',
    icon: 'producthunt',
    color: '#DA552F',
    sortOrder: 12,
    description: 'Product Hunt 每日 AI 产品榜',
  },
  {
    sourceCode: 'github-trending',
    sourceName: 'GitHub Trending',
    sourceType: 'hotlist',
    endpoint: '/news/github-trending',
    category: 'tech-community',
    icon: 'github',
    color: '#181717',
    sortOrder: 13,
    description: 'GitHub Trending(AI/LLM 仓库)',
  },
  {
    sourceCode: 'techcrunch',
    sourceName: 'TechCrunch',
    sourceType: 'hotlist',
    endpoint: '/news/techcrunch',
    category: 'ai-media',
    icon: 'techcrunch',
    color: '#0A9E01',
    sortOrder: 14,
    description: 'TechCrunch AI 板块',
  },

  // ===== RSS(厂商博客 5 个,走 RSSHub)=====
  {
    sourceCode: 'openai-blog',
    sourceName: 'OpenAI Blog',
    sourceType: 'rss',
    endpoint: '/openai/blog',
    category: 'ai-media',
    icon: 'openai',
    color: '#10A37F',
    sortOrder: 21,
    description: 'OpenAI 官方博客一手发布',
  },
  {
    sourceCode: 'anthropic-blog',
    sourceName: 'Anthropic Blog',
    sourceType: 'rss',
    endpoint: '/anthropic/blog',
    category: 'ai-media',
    icon: 'anthropic',
    color: '#D97757',
    sortOrder: 22,
    description: 'Anthropic 官方博客一手发布',
  },
  {
    sourceCode: 'google-ai',
    sourceName: 'Google AI Blog',
    sourceType: 'rss',
    endpoint: '/google-ai',
    category: 'ai-media',
    icon: 'google',
    color: '#4285F4',
    sortOrder: 23,
    description: 'Google DeepMind / Research 博客',
  },
  {
    sourceCode: 'arxiv-cs-ai',
    sourceName: 'arXiv CS.AI',
    sourceType: 'rss',
    endpoint: '/arxiv-cs-ai',
    category: 'ai-paper',
    icon: 'arxiv',
    color: '#B31B1B',
    sortOrder: 24,
    description: 'arXiv 计算机科学 - AI 最新论文',
  },
  {
    sourceCode: 'mit-tech-review',
    sourceName: 'MIT Technology Review',
    sourceType: 'rss',
    endpoint: '/mit-tech-review',
    category: 'ai-media',
    icon: 'mit',
    color: '#A41F35',
    sortOrder: 25,
    description: '麻省理工科技评论 AI 板块',
  },
]

export async function seedAiFeedSources() {
  console.log(`开始导入 ${sources.length} 条 AI 资讯信源...`)

  let inserted = 0
  let updated = 0

  for (const src of sources) {
    const [existing] = await db
      .select()
      .from(aiFeedSource)
      .where(eq(aiFeedSource.sourceCode, src.sourceCode))

    if (existing) {
      // 已存在:仅更新可变字段,不重置 enabled / lastFetchAt / lastFetchStatus / lastFetchCount
      await db
        .update(aiFeedSource)
        .set({
          sourceName: src.sourceName,
          sourceType: src.sourceType,
          endpoint: src.endpoint,
          category: src.category,
          icon: src.icon,
          color: src.color,
          sortOrder: src.sortOrder,
          description: src.description,
          fetchIntervalMinutes: 360, // 与 cron 6h 对齐
          updatedAt: new Date(),
        })
        .where(eq(aiFeedSource.sourceCode, src.sourceCode))
      updated++
    } else {
      await db.insert(aiFeedSource).values({
        sourceCode: src.sourceCode,
        sourceName: src.sourceName,
        sourceType: src.sourceType,
        endpoint: src.endpoint,
        category: src.category,
        icon: src.icon,
        color: src.color,
        enabled: true,
        sortOrder: src.sortOrder,
        fetchIntervalMinutes: 360,
        description: src.description,
      })
      inserted++
    }
  }

  console.log(
    `AI 资讯信源导入完成: 新增 ${inserted} 条, 更新 ${updated} 条, 共 ${sources.length} 条`,
  )
}
