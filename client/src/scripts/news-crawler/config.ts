/**
 * 新闻抓取配置
 * 定义国内外AI权威新闻源
 */

export interface NewsSource {
  id: string
  name: string
  url: string
  type: 'rss' | 'api' | 'scraper'
  language: 'zh' | 'en'
  category: 'ai' | 'tech' | 'general'
  enabled: boolean
  headers?: Record<string, string>
  apiKey?: string
}

// 国内外AI权威新闻源列表
export const NEWS_SOURCES: NewsSource[] = [
  // 国内AI新闻源
  {
    id: '36kr-ai',
    name: '36氪 - AI',
    url: 'https://36kr.com/feed',
    type: 'rss',
    language: 'zh',
    category: 'ai',
    enabled: true,
  },
  {
    id: '36kr-tech',
    name: '36氪 - 科技',
    url: 'https://36kr.com/feed',
    type: 'rss',
    language: 'zh',
    category: 'tech',
    enabled: true,
  },
  {
    id: 'huxiu',
    name: '虎嗅',
    url: 'https://www.huxiu.com/rss/0.xml',
    type: 'rss',
    language: 'zh',
    category: 'tech',
    enabled: true,
  },
  {
    id: 'tmt-post',
    name: '钛媒体',
    url: 'https://www.tmtpost.com/rss',
    type: 'rss',
    language: 'zh',
    category: 'tech',
    enabled: true,
  },
  {
    id: 'infoq',
    name: 'InfoQ',
    url: 'https://www.infoq.cn/feed',
    type: 'rss',
    language: 'zh',
    category: 'tech',
    enabled: true,
  },
  {
    id: 'jiqizhixin',
    name: '机器之心',
    url: 'https://www.jiqizhixin.com/rss',
    type: 'rss',
    language: 'zh',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'qbitai',
    name: '量子位',
    url: 'https://www.qbitai.com/feed',
    type: 'rss',
    language: 'zh',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'ifanr',
    name: '爱范儿',
    url: 'https://www.ifanr.com/feed',
    type: 'rss',
    language: 'zh',
    category: 'tech',
    enabled: true,
  },
  {
    id: 'geekpark',
    name: '极客公园',
    url: 'https://www.geekpark.net/rss',
    type: 'rss',
    language: 'zh',
    category: 'tech',
    enabled: true,
  },
  {
    id: 'leiphone',
    name: '雷锋网',
    url: 'https://www.leiphone.com/feed',
    type: 'rss',
    language: 'zh',
    category: 'tech',
    enabled: true,
  },
  {
    id: 'sifou',
    name: '思否',
    url: 'https://segmentfault.com/blogs',
    type: 'rss',
    language: 'zh',
    category: 'tech',
    enabled: true,
  },
  // 国外AI新闻源
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch - AI',
    url: 'https://techcrunch.com/tag/artificial-intelligence/feed/',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'techcrunch-tech',
    name: 'TechCrunch - Tech',
    url: 'https://techcrunch.com/feed/',
    type: 'rss',
    language: 'en',
    category: 'tech',
    enabled: true,
  },
  {
    id: 'the-verge-ai',
    name: 'The Verge - AI',
    url: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'the-verge-tech',
    name: 'The Verge - Tech',
    url: 'https://www.theverge.com/rss/index.xml',
    type: 'rss',
    language: 'en',
    category: 'tech',
    enabled: true,
  },
  {
    id: 'wired-ai',
    name: 'Wired - AI',
    url: 'https://www.wired.com/feed/tag/artificial-intelligence/',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'wired-tech',
    name: 'Wired - Tech',
    url: 'https://www.wired.com/feed/',
    type: 'rss',
    language: 'en',
    category: 'tech',
    enabled: true,
  },
  {
    id: 'mit-tech-review',
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
    type: 'rss',
    language: 'en',
    category: 'tech',
    enabled: true,
  },
  {
    id: 'openai-blog',
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog/rss.xml',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'deepmind-blog',
    name: 'DeepMind Blog',
    url: 'https://deepmind.com/blog/feed/basic/',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'anthropic-blog',
    name: 'Anthropic Blog',
    url: 'https://www.anthropic.com/news/rss',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'google-ai-blog',
    name: 'Google AI Blog',
    url: 'https://ai.googleblog.com/feeds/posts/default',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'microsoft-ai-blog',
    name: 'Microsoft AI Blog',
    url: 'https://blogs.microsoft.com/ai/feed/',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'meta-ai-blog',
    name: 'Meta AI Blog',
    url: 'https://ai.meta.com/blog/feed/',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'nvidia-blog',
    name: 'NVIDIA Blog',
    url: 'https://blogs.nvidia.com/feed/',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'ai-news',
    name: 'AI News',
    url: 'https://www.artificialintelligence-news.com/feed/',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'venturebeat-ai',
    name: 'VentureBeat - AI',
    url: 'https://venturebeat.com/ai/feed/',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'ai-trends',
    name: 'AI Trends',
    url: 'https://aitrends.com/feed/',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'singularity-hub',
    name: 'Singularity Hub',
    url: 'https://singularityhub.com/feed/',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'arxiv-ai',
    name: 'arXiv - AI',
    url: 'https://export.arxiv.org/rss/cs.AI',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'towards-data-science',
    name: 'Towards Data Science',
    url: 'https://towardsdatascience.com/feed',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'kdnuggets',
    name: 'KDnuggets',
    url: 'https://www.kdnuggets.com/feed',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'medium-ai',
    name: 'Medium - AI',
    url: 'https://medium.com/tag/artificial-intelligence/feed',
    type: 'rss',
    language: 'en',
    category: 'ai',
    enabled: true,
  },
  {
    id: 'venturebeat-gaming',
    name: 'VentureBeat - Gaming',
    url: 'https://venturebeat.com/category/gaming/feed/',
    type: 'rss',
    language: 'en',
    category: 'tech',
    enabled: true,
  },
  {
    id: 'arstechnica',
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    type: 'rss',
    language: 'en',
    category: 'tech',
    enabled: true,
  },
  {
    id: 'engadget',
    name: 'Engadget',
    url: 'https://www.engadget.com/rss.xml',
    type: 'rss',
    language: 'en',
    category: 'tech',
    enabled: true,
  },
]

// 定时任务配置 - 每天两个时间段
export const SCHEDULE_CONFIG = {
  // 早上8点（北京时间）
  morning: {
    hour: 8,
    minute: 0,
    timezone: 'Asia/Shanghai',
  },
  // 晚上8点（北京时间）
  evening: {
    hour: 20,
    minute: 0,
    timezone: 'Asia/Shanghai',
  },
}

// 抓取配置
export const CRAWLER_CONFIG = {
  // 每次抓取的最大新闻数量
  maxItemsPerSource: 50,
  // 请求超时时间（毫秒）
  timeout: 60000,
  // 请求间隔（毫秒）- 避免过于频繁请求
  requestDelay: 500,
  // 用户代理
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}
