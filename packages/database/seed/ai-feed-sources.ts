import { createDb } from '../src/client.js'
import { aiFeedSource } from '../src/schema/ai-feed.js'
import { eq } from 'drizzle-orm'

const db = createDb(
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui',
)

/**
 * AI 资讯信源种子数据(参考 aihot.virxact.com/all 信源结构 + 权威扩充)。
 *
 * 五类信源:
 * 1. firstParty 国际厂商(12 个):OpenAI/Anthropic/Google DeepMind/Meta/Microsoft/Apple/Mistral/Cohere/HuggingFace/NVIDIA/Stability/xAI
 * 2. firstParty 国内厂商(6 个):通义千问/智谱清言/DeepSeek/月之暗面/腾讯混元/硅基流动
 * 3. news 国际媒体(5 个):MIT Tech Review/TechCrunch/The Verge/VentureBeat/Wired
 * 4. news 国内媒体(5 个):机器之心/量子位/智东西/雷锋网/PaperWeekly
 * 5. paper 学术(2 个):arXiv CS.AI / CS.CL
 * 6. hotlist 热榜(10 个):国内 8 + 国外 2
 *
 * fetchIntervalMinutes 默认 360(6 小时),与 ai-feed-collect cron 每 6 小时一次对齐。
 * 幂等 upsert:已存在则只更新可变字段,不重置 enabled/lastFetchAt/lastFetchStatus。
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
  // ===== 一手国际厂商(firstParty RSS,12 个)=====
  {
    sourceCode: 'openai-blog',
    sourceName: 'OpenAI Blog',
    sourceType: 'rss',
    endpoint: '/openai/blog',
    category: 'first-party',
    icon: 'openai',
    color: '#10A37F',
    sortOrder: 101,
    description: 'OpenAI 官方博客(GPT 系列 / DALL-E / Sora 一手发布)',
  },
  {
    sourceCode: 'anthropic-blog',
    sourceName: 'Anthropic Blog',
    sourceType: 'rss',
    endpoint: '/anthropic/blog',
    category: 'first-party',
    icon: 'anthropic',
    color: '#D97757',
    sortOrder: 102,
    description: 'Anthropic 官方博客(Claude 系列一手发布)',
  },
  {
    sourceCode: 'google-deepmind',
    sourceName: 'Google DeepMind Blog',
    sourceType: 'rss',
    endpoint: '/deepmind/blog',
    category: 'first-party',
    icon: 'google',
    color: '#4285F4',
    sortOrder: 103,
    description: 'Google DeepMind 官方博客(Gemini / AlphaFold / AlphaCode)',
  },
  {
    sourceCode: 'meta-ai',
    sourceName: 'Meta AI Blog',
    sourceType: 'rss',
    endpoint: '/meta-ai',
    category: 'first-party',
    icon: 'meta',
    color: '#0668E1',
    sortOrder: 104,
    description: 'Meta AI 官方博客(Llama 系列 / SeamlessM4T / Code Llama)',
  },
  {
    sourceCode: 'microsoft-research',
    sourceName: 'Microsoft Research Blog',
    sourceType: 'rss',
    endpoint: '/microsoft-research',
    category: 'first-party',
    icon: 'microsoft',
    color: '#0078D4',
    sortOrder: 105,
    description: '微软研究院博客(Phi 系列 / Orca / WizardLM)',
  },
  {
    sourceCode: 'apple-ml',
    sourceName: 'Apple ML Research',
    sourceType: 'rss',
    endpoint: '/apple-machine-learning',
    category: 'first-party',
    icon: 'apple',
    color: '#000000',
    sortOrder: 106,
    description: 'Apple 机器学习研究博客(MLX / Ferret / OpenELM)',
  },
  {
    sourceCode: 'mistral-ai',
    sourceName: 'Mistral AI Blog',
    sourceType: 'rss',
    endpoint: '/mistral-ai',
    category: 'first-party',
    icon: 'mistral',
    color: '#FF7000',
    sortOrder: 107,
    description: 'Mistral AI 官方博客(Mistral / Mixtral 系列)',
  },
  {
    sourceCode: 'cohere-blog',
    sourceName: 'Cohere Blog',
    sourceType: 'rss',
    endpoint: '/cohere/blog',
    category: 'first-party',
    icon: 'cohere',
    color: '#39594D',
    sortOrder: 108,
    description: 'Cohere 官方博客(Command / Command R+ 系列)',
  },
  {
    sourceCode: 'huggingface-blog',
    sourceName: 'Hugging Face Blog',
    sourceType: 'rss',
    endpoint: '/huggingface/blog',
    category: 'first-party',
    icon: 'huggingface',
    color: '#FFD21E',
    sortOrder: 109,
    description: 'Hugging Face 官方博客(模型生态 / Transformers / Spaces)',
  },
  {
    sourceCode: 'nvidia-ai',
    sourceName: 'NVIDIA AI Blog',
    sourceType: 'rss',
    endpoint: '/nvidia-ai',
    category: 'first-party',
    icon: 'nvidia',
    color: '#76B900',
    sortOrder: 110,
    description: 'NVIDIA AI 官方博客(NIM / TensorRT / GPU 算力生态)',
  },
  {
    sourceCode: 'stability-ai',
    sourceName: 'Stability AI Blog',
    sourceType: 'rss',
    endpoint: '/stability-ai',
    category: 'first-party',
    icon: 'stability',
    color: '#8B5CF6',
    sortOrder: 111,
    description: 'Stability AI 官方博客(Stable Diffusion / Stable Video)',
  },
  {
    sourceCode: 'xai-news',
    sourceName: 'xAI News',
    sourceType: 'rss',
    endpoint: '/xai-news',
    category: 'first-party',
    icon: 'xai',
    color: '#000000',
    sortOrder: 112,
    description: 'xAI 官方新闻(Grok 系列 / Colossus 算力)',
  },

  // ===== 一手国内厂商(firstParty RSS,6 个)=====
  {
    sourceCode: 'qwen',
    sourceName: '通义千问',
    sourceType: 'rss',
    endpoint: '/qwen',
    category: 'first-party',
    icon: 'qwen',
    color: '#615CED',
    sortOrder: 121,
    description: '阿里通义千问官方(Qwen 系列 / 通义万相 / 通义听悟)',
  },
  {
    sourceCode: 'zhipu',
    sourceName: '智谱清言',
    sourceType: 'rss',
    endpoint: '/zhipu',
    category: 'first-party',
    icon: 'zhipu',
    color: '#1A56DB',
    sortOrder: 122,
    description: '智谱 AI 官方(ChatGLM / GLM-4 / CogVideoX 系列)',
  },
  {
    sourceCode: 'deepseek',
    sourceName: 'DeepSeek',
    sourceType: 'rss',
    endpoint: '/deepseek',
    category: 'first-party',
    icon: 'deepseek',
    color: '#4D6BFE',
    sortOrder: 123,
    description: 'DeepSeek 官方(DeepSeek-V2 / V3 / R1 推理模型)',
  },
  {
    sourceCode: 'moonshot',
    sourceName: '月之暗面',
    sourceType: 'rss',
    endpoint: '/moonshot',
    category: 'first-party',
    icon: 'moonshot',
    color: '#0F172A',
    sortOrder: 124,
    description: 'Moonshot AI 官方(Kimi 系列 / Kimi 探索版)',
  },
  {
    sourceCode: 'tencent-hunyuan',
    sourceName: '腾讯混元',
    sourceType: 'rss',
    endpoint: '/tencent-hunyuan',
    category: 'first-party',
    icon: 'tencent',
    color: '#00A4FF',
    sortOrder: 125,
    description: '腾讯混元大模型官方(混元-Large / 混元-3D)',
  },
  {
    sourceCode: 'siliconflow',
    sourceName: '硅基流动',
    sourceType: 'rss',
    endpoint: '/siliconflow',
    category: 'first-party',
    icon: 'siliconflow',
    color: '#00D4AA',
    sortOrder: 126,
    description: 'SiliconFlow 官方(推理云 / OneDiff / 模型 API 聚合)',
  },

  // ===== 资讯国际媒体(news RSS,5 个)=====
  {
    sourceCode: 'mit-tech-review',
    sourceName: 'MIT Technology Review',
    sourceType: 'rss',
    endpoint: '/mit-tech-review',
    category: 'ai-media',
    icon: 'mit',
    color: '#A41F35',
    sortOrder: 201,
    description: '麻省理工科技评论 AI 板块(深度报道 / 行业分析)',
  },
  {
    sourceCode: 'techcrunch-ai',
    sourceName: 'TechCrunch AI',
    sourceType: 'rss',
    endpoint: '/techcrunch-ai',
    category: 'ai-media',
    icon: 'techcrunch',
    color: '#0A9E01',
    sortOrder: 202,
    description: 'TechCrunch AI 频道(融资 / 创投 / 行业动态)',
  },
  {
    sourceCode: 'the-verge-ai',
    sourceName: 'The Verge AI',
    sourceType: 'rss',
    endpoint: '/the-verge/ai',
    category: 'ai-media',
    icon: 'verge',
    color: '#5200FF',
    sortOrder: 203,
    description: 'The Verge AI 板块(产品评测 / 行业新闻)',
  },
  {
    sourceCode: 'venturebeat-ai',
    sourceName: 'VentureBeat AI',
    sourceType: 'rss',
    endpoint: '/venturebeat/ai',
    category: 'ai-media',
    icon: 'venturebeat',
    color: '#FF1A1A',
    sortOrder: 204,
    description: 'VentureBeat AI 频道(企业 AI / 模型评测)',
  },
  {
    sourceCode: 'wired-ai',
    sourceName: 'Wired AI',
    sourceType: 'rss',
    endpoint: '/wired/ai',
    category: 'ai-media',
    icon: 'wired',
    color: '#000000',
    sortOrder: 205,
    description: 'Wired 杂志 AI 板块(科技文化 / 长篇报道)',
  },

  // ===== 资讯国内媒体(news RSS,5 个)=====
  {
    sourceCode: 'jiqizhixin',
    sourceName: '机器之心',
    sourceType: 'rss',
    endpoint: '/jiqizhixin',
    category: 'ai-media',
    icon: 'jiqizhixin',
    color: '#C7254E',
    sortOrder: 211,
    description: '机器之心(国内 AI 媒体头部,论文解读 / 产业报道)',
  },
  {
    sourceCode: 'qbitai',
    sourceName: '量子位',
    sourceType: 'rss',
    endpoint: '/qbitai',
    category: 'ai-media',
    icon: 'qbitai',
    color: '#2E7D32',
    sortOrder: 212,
    description: '量子位(国内 AI 资讯,前沿动态 / 深度分析)',
  },
  {
    sourceCode: 'xinzhiqiang',
    sourceName: '智东西',
    sourceType: 'rss',
    endpoint: '/xinzhiqiang',
    category: 'ai-media',
    icon: 'xinzhiqiang',
    color: '#1565C0',
    sortOrder: 213,
    description: '智东西(AI 产业媒体,产品评测 / 行业洞察)',
  },
  {
    sourceCode: 'leiphone-ai',
    sourceName: '雷锋网 AI',
    sourceType: 'rss',
    endpoint: '/leiphone/ai',
    category: 'ai-media',
    icon: 'leiphone',
    color: '#E53935',
    sortOrder: 214,
    description: '雷锋网 AI 频道(产业报道 / 学术合作)',
  },
  {
    sourceCode: 'paperweekly',
    sourceName: 'PaperWeekly',
    sourceType: 'rss',
    endpoint: '/paperweekly',
    category: 'ai-paper',
    icon: 'paperweekly',
    color: '#5C6BC0',
    sortOrder: 215,
    description: 'PaperWeekly(论文社区,每周精选 / 作者解读)',
  },

  // ===== 学术论文(paper RSS,2 个)=====
  {
    sourceCode: 'arxiv-cs-ai',
    sourceName: 'arXiv CS.AI',
    sourceType: 'rss',
    endpoint: '/arxiv-cs-ai',
    category: 'ai-paper',
    icon: 'arxiv',
    color: '#B31B1B',
    sortOrder: 221,
    description: 'arXiv 计算机科学 - 人工智能最新论文',
  },
  {
    sourceCode: 'arxiv-cs-cl',
    sourceName: 'arXiv CS.CL',
    sourceType: 'rss',
    endpoint: '/arxiv-cs-cl',
    category: 'ai-paper',
    icon: 'arxiv',
    color: '#B31B1B',
    sortOrder: 222,
    description: 'arXiv 计算机科学 - 计算语言学(NLP)最新论文',
  },

  // ===== 国内 hotlist(DailyHotApi,8 个)=====
  {
    sourceCode: 'weibo',
    sourceName: '微博热搜',
    sourceType: 'hotlist',
    endpoint: '/news/weibo',
    category: 'general',
    icon: 'weibo',
    color: '#E6162D',
    sortOrder: 301,
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
    sortOrder: 302,
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
    sortOrder: 303,
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
    sortOrder: 304,
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
    sortOrder: 305,
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
    sortOrder: 306,
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
    sortOrder: 307,
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
    sortOrder: 308,
    description: 'IT之家热门资讯(AI 板块)',
  },

  // ===== 国外 hotlist(DailyHotApi,3 个)=====
  {
    sourceCode: 'hackernews',
    sourceName: 'Hacker News',
    sourceType: 'hotlist',
    endpoint: '/news/hackernews',
    category: 'tech-community',
    icon: 'hackernews',
    color: '#FF6600',
    sortOrder: 311,
    description: 'Y Combinator Hacker News 热门(全球开发者社区)',
  },
  {
    sourceCode: 'producthunt',
    sourceName: 'Product Hunt',
    sourceType: 'hotlist',
    endpoint: '/news/producthunt',
    category: 'general',
    icon: 'producthunt',
    color: '#DA552F',
    sortOrder: 312,
    description: 'Product Hunt 每日 AI 产品榜(全球新品发现)',
  },
  {
    sourceCode: 'github-trending',
    sourceName: 'GitHub Trending',
    sourceType: 'hotlist',
    endpoint: '/news/github-trending',
    category: 'tech-community',
    icon: 'github',
    color: '#181717',
    sortOrder: 313,
    description: 'GitHub Trending(AI/LLM 仓库热度榜)',
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
