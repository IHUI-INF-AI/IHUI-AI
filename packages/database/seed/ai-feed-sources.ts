import { createDb } from '../src/client.js'
import { aiFeedSource } from '../src/schema/ai-feed.js'
import { eq, notInArray } from 'drizzle-orm'

const db = createDb(
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:8810/ihui',
)

/**
 * AI 资讯信源种子数据(参考 aihot.virxact.com/all 信源结构 + 权威扩充)。
 *
 * 所有 endpoint 均为已验证可用的原生 RSS 或本地 DailyHotApi 路由。
 * 公共 RSSHub/DailyHotApi 实例全失效,改用:
 *  - 厂商/媒体:原生 RSS feed(已 curl 验证 XML 格式)
 *  - 国内 hotlist:本地自建 DailyHotApi(http://localhost:6688)
 *
 * fetchIntervalMinutes 默认 360(6 小时),与 ai-feed-collect cron 每 6 小时一次对齐。
 * 幂等 upsert:已存在则只更新可变字段,不重置 lastFetchAt/lastFetchStatus/lastFetchCount。
 * 未在 sources 数组中的信源自动 enabled=false(避免 cron 浪费请求)。
 */

interface SourceSeed {
  sourceCode: string
  sourceName: string
  sourceType: 'hotlist' | 'rss' | 'api'
  endpoint: string
  category: 'general' | 'ai-media' | 'ai-paper' | 'tech-community' | 'first-party'
  icon: string | null
  color: string | null
  sortOrder: number
  description: string | null
}

const sources: SourceSeed[] = [
  // ===== 一手国际厂商(firstParty RSS,8 个,已验证原生 RSS)=====
  {
    sourceCode: 'openai-blog',
    sourceName: 'OpenAI Blog',
    sourceType: 'rss',
    endpoint: 'https://openai.com/blog/rss.xml',
    category: 'first-party',
    icon: 'openai',
    color: '#10A37F',
    sortOrder: 101,
    description: 'OpenAI 官方博客原生 RSS(GPT 系列 / DALL-E / Sora 一手发布)',
  },
  {
    sourceCode: 'google-deepmind',
    sourceName: 'Google DeepMind Blog',
    sourceType: 'rss',
    endpoint: 'https://blog.research.google/feeds/posts/default',
    category: 'first-party',
    icon: 'google',
    color: '#4285F4',
    sortOrder: 103,
    description: 'Google Research / DeepMind 官方博客原生 RSS(Gemini / AlphaFold / AlphaCode)',
  },
  {
    sourceCode: 'meta-ai',
    sourceName: 'Meta AI Research',
    sourceType: 'rss',
    endpoint: 'https://research.facebook.com/feed/',
    category: 'first-party',
    icon: 'meta',
    color: '#0668E1',
    sortOrder: 104,
    description: 'Meta AI Research 原生 RSS(Llama 系列 / SeamlessM4T / Code Llama)',
  },
  {
    sourceCode: 'microsoft-research',
    sourceName: 'Microsoft Research Blog',
    sourceType: 'rss',
    endpoint: 'https://www.microsoft.com/en-us/research/feed/',
    category: 'first-party',
    icon: 'microsoft',
    color: '#0078D4',
    sortOrder: 105,
    description: '微软研究院博客原生 RSS(Phi 系列 / Orca / WizardLM)',
  },
  {
    sourceCode: 'apple-ml',
    sourceName: 'Apple ML Research',
    sourceType: 'rss',
    endpoint: 'https://machinelearning.apple.com/rss.xml',
    category: 'first-party',
    icon: 'apple',
    color: '#000000',
    sortOrder: 106,
    description: 'Apple 机器学习研究博客原生 RSS(MLX / Ferret / OpenELM)',
  },
  {
    sourceCode: 'mistral-ai',
    sourceName: 'Mistral AI Blog',
    sourceType: 'rss',
    endpoint: 'https://mistral.ai/rss.xml',
    category: 'first-party',
    icon: 'mistral',
    color: '#FF7000',
    sortOrder: 107,
    description: 'Mistral AI 官方原生 RSS(Mistral / Mixtral 系列)',
  },
  {
    sourceCode: 'huggingface-blog',
    sourceName: 'Hugging Face Blog',
    sourceType: 'rss',
    endpoint: 'https://huggingface.co/blog/feed.xml',
    category: 'first-party',
    icon: 'huggingface',
    color: '#FFD21E',
    sortOrder: 109,
    description: 'Hugging Face 官方博客原生 RSS(模型生态 / Transformers / Spaces)',
  },
  {
    sourceCode: 'nvidia-ai',
    sourceName: 'NVIDIA AI Blog',
    sourceType: 'rss',
    endpoint: 'https://blogs.nvidia.com/feed/',
    category: 'first-party',
    icon: 'nvidia',
    color: '#76B900',
    sortOrder: 110,
    description: 'NVIDIA AI 官方博客原生 RSS(NIM / TensorRT / GPU 算力生态)',
  },

  // ===== 资讯国际媒体(news RSS,5 个,已验证原生 RSS)=====
  {
    sourceCode: 'mit-tech-review',
    sourceName: 'MIT Technology Review',
    sourceType: 'rss',
    endpoint: 'https://www.technologyreview.com/feed/',
    category: 'ai-media',
    icon: 'mit',
    color: '#A41F35',
    sortOrder: 201,
    description: '麻省理工科技评论原生 RSS(深度报道 / 行业分析)',
  },
  {
    sourceCode: 'techcrunch-ai',
    sourceName: 'TechCrunch AI',
    sourceType: 'rss',
    endpoint: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    category: 'ai-media',
    icon: 'techcrunch',
    color: '#0A9E01',
    sortOrder: 202,
    description: 'TechCrunch AI 频道原生 RSS(融资 / 创投 / 行业动态)',
  },
  {
    sourceCode: 'the-verge-ai',
    sourceName: 'The Verge AI',
    sourceType: 'rss',
    endpoint: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    category: 'ai-media',
    icon: 'verge',
    color: '#5200FF',
    sortOrder: 203,
    description: 'The Verge AI 板块原生 RSS(产品评测 / 行业新闻)',
  },
  {
    sourceCode: 'venturebeat-ai',
    sourceName: 'VentureBeat',
    sourceType: 'rss',
    endpoint: 'https://feeds.feedburner.com/venturebeat/SZYF',
    category: 'ai-media',
    icon: 'venturebeat',
    color: '#FF1A1A',
    sortOrder: 204,
    description: 'VentureBeat 全站原生 RSS via FeedBurner(企业 AI / 模型评测,LLM 自动筛选 AI 条目)',
  },
  {
    sourceCode: 'wired-ai',
    sourceName: 'Wired AI',
    sourceType: 'rss',
    endpoint: 'https://www.wired.com/feed/tag/ai/latest/rss',
    category: 'ai-media',
    icon: 'wired',
    color: '#000000',
    sortOrder: 205,
    description: 'Wired 杂志 AI 板块原生 RSS(科技文化 / 长篇报道)',
  },

  // ===== 资讯国内媒体(news RSS,2 个,已验证原生 RSS)=====
  {
    sourceCode: 'qbitai',
    sourceName: '量子位',
    sourceType: 'rss',
    endpoint: 'https://www.qbitai.com/feed',
    category: 'ai-media',
    icon: 'qbitai',
    color: '#2E7D32',
    sortOrder: 212,
    description: '量子位原生 RSS(国内 AI 资讯,前沿动态 / 深度分析)',
  },
  {
    sourceCode: 'leiphone-ai',
    sourceName: '雷锋网',
    sourceType: 'rss',
    endpoint: 'https://www.leiphone.com/feed',
    category: 'ai-media',
    icon: 'leiphone',
    color: '#E53935',
    sortOrder: 214,
    description: '雷锋网全站原生 RSS(产业报道 / AI 频道,LLM 自动筛选 AI 条目)',
  },

  // ===== 学术论文(paper RSS,2 个)=====
  {
    sourceCode: 'arxiv-cs-ai',
    sourceName: 'arXiv CS.AI',
    sourceType: 'rss',
    endpoint: 'https://export.arxiv.org/rss/cs.AI',
    category: 'ai-paper',
    icon: 'arxiv',
    color: '#B31B1B',
    sortOrder: 221,
    description: 'arXiv 计算机科学 - 人工智能最新论文(原生 RSS)',
  },
  {
    sourceCode: 'arxiv-cs-cl',
    sourceName: 'arXiv CS.CL',
    sourceType: 'rss',
    endpoint: 'https://export.arxiv.org/rss/cs.CL',
    category: 'ai-paper',
    icon: 'arxiv',
    color: '#B31B1B',
    sortOrder: 222,
    description: 'arXiv 计算机科学 - 计算语言学(NLP)最新论文(原生 RSS)',
  },

  // ===== 技术社区 + 国外 hotlist(3 个,已验证原生 RSS)=====
  {
    sourceCode: 'hackernews',
    sourceName: 'Hacker News',
    sourceType: 'rss',
    endpoint: 'https://hnrss.org/frontpage',
    category: 'tech-community',
    icon: 'hackernews',
    color: '#FF6600',
    sortOrder: 311,
    description: 'Y Combinator Hacker News 原生 RSS(全球开发者社区)',
  },
  {
    sourceCode: 'github-trending',
    sourceName: 'GitHub Trending',
    sourceType: 'rss',
    endpoint: 'https://mshibanami.github.io/GitHubTrendingRSS/daily/all.xml',
    category: 'tech-community',
    icon: 'github',
    color: '#181717',
    sortOrder: 313,
    description: 'GitHub Trending 原生 RSS(AI/LLM 仓库热度榜)',
  },
  {
    sourceCode: 'sspai',
    sourceName: '少数派',
    sourceType: 'rss',
    endpoint: 'https://sspai.com/feed',
    category: 'tech-community',
    icon: 'sspai',
    color: '#D33A31',
    sortOrder: 304,
    description: '少数派原生 RSS(AI 工具与实践文章)',
  },

  // ===== 国内 hotlist(本地自建 DailyHotApi,7 个)=====
  {
    sourceCode: 'weibo',
    sourceName: '微博热搜',
    sourceType: 'hotlist',
    endpoint: '/weibo',
    category: 'general',
    icon: 'weibo',
    color: '#E6162D',
    sortOrder: 301,
    description: '微博实时热搜榜(本地 DailyHotApi,LLM 筛选 AI 相关)',
  },
  {
    sourceCode: 'zhihu',
    sourceName: '知乎热榜',
    sourceType: 'hotlist',
    endpoint: '/zhihu',
    category: 'general',
    icon: 'zhihu',
    color: '#0084FF',
    sortOrder: 302,
    description: '知乎热门话题(本地 DailyHotApi,LLM 筛选 AI 相关)',
  },
  {
    sourceCode: '36kr',
    sourceName: '36氪',
    sourceType: 'hotlist',
    endpoint: '/36kr',
    category: 'general',
    icon: '36kr',
    color: '#0061FE',
    sortOrder: 303,
    description: '36氪热榜(本地 DailyHotApi,AI 行业动态)',
  },
  {
    sourceCode: 'juejin',
    sourceName: '掘金',
    sourceType: 'hotlist',
    endpoint: '/juejin',
    category: 'tech-community',
    icon: 'juejin',
    color: '#1E80FF',
    sortOrder: 305,
    description: '掘金技术热榜(本地 DailyHotApi,AI 编程与算法)',
  },
  {
    sourceCode: 'v2ex',
    sourceName: 'V2EX',
    sourceType: 'hotlist',
    endpoint: '/v2ex',
    category: 'tech-community',
    icon: 'v2ex',
    color: '#333333',
    sortOrder: 306,
    description: 'V2EX 主题榜(本地 DailyHotApi,AI 话题)',
  },
  {
    sourceCode: 'bilibili',
    sourceName: '哔哩哔哩',
    sourceType: 'hotlist',
    endpoint: '/bilibili',
    category: 'general',
    icon: 'bilibili',
    color: '#FB7299',
    sortOrder: 307,
    description: 'B站热门视频(本地 DailyHotApi,AI 教程与资讯)',
  },
  {
    sourceCode: 'ithome',
    sourceName: 'IT之家',
    sourceType: 'hotlist',
    endpoint: '/ithome',
    category: 'ai-media',
    icon: 'ithome',
    color: '#DA251D',
    sortOrder: 308,
    description: 'IT之家热榜(本地 DailyHotApi,AI 板块)',
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
      // 已存在:更新可变字段 + enabled=true(重新启用)
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
          enabled: true,
          fetchIntervalMinutes: 360,
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

  // 禁用 sources 数组中不存在的信源(无可用原生 RSS 的信源)
  const activeCodes = sources.map((s) => s.sourceCode)
  const disabledResult = await db
    .update(aiFeedSource)
    .set({ enabled: false, updatedAt: new Date() })
    .where(notInArray(aiFeedSource.sourceCode, activeCodes))

  console.log(
    `AI 资讯信源导入完成: 新增 ${inserted} 条, 更新 ${updated} 条, 共 ${sources.length} 条; 已禁用 ${disabledResult.count} 条无可用源信源`,
  )
}
