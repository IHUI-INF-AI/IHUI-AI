/**
 * AI World 数据同步任务(深度打磨版 2026-07-22)
 *
 * 数据源(只用原始源,严禁抓 ai-bot.cn):
 * 1. AI 资讯官方 blog RSS(12 站:OpenAI / Anthropic / DeepMind / Meta / MS / HF / Stability / Mistral / Cohere / NVIDIA / Google Research / Apple ML)
 * 2. 国外科技媒体 RSS(8 站:TechCrunch / The Verge / VentureBeat / MIT Tech Review / Wired / Ars Technica / The Information / Stratechery)
 * 3. 国内 AI 媒体 RSS(10 站,走 RSSHUB_URL:量子位 / 机器之心 / 新智元 / AI 科技评论 / PaperWeekly / AI 前线 / InfoQ AI / 36氪 AI / 雷锋网 AI / 澎湃 AI)
 * 4. AI 论文(arXiv cs.AI+CL+LG+CV+NE+stat.ML + Hugging Face Daily Papers)
 * 5. GitHub Trending(12 topics:ai/llm/ml/dl/transformer/chatbot/langchain/agent/diffusion/gpt/rag/neural-network)
 * 6. AI APP 元数据(35+ 国内外应用官网 cheerio 抓取)
 * 7. AI 工具元数据(35+ 国内外工具官网 cheerio 抓取)
 *
 * 调度:node-cron `0 0,12 * * *`(每日 0 点 + 12 点各跑一次,12 小时间隔)
 * 失败重试:单源 3 次重试,3 次失败写 aiWorldSyncLog 表 + 跳过,不阻塞其他源
 * LLM 改写:用项目内 AI_SERVICE_URL/llm/complete,批处理 + 失败降级用原始摘要
 * 反抄袭:UI/字体/icon 用本项目 token,分类 slug 全自定义,文案用原始源原文
 */

import cron, { type ScheduledTask } from 'node-cron'
import RSSParser from 'rss-parser'
import * as cheerio from 'cheerio'
import { and, eq } from 'drizzle-orm'
import {
  aiWorldCategories,
  aiWorldItems,
  aiWorldSyncLog,
  type NewAiWorldItem,
} from '@ihui/database'

import { db } from '../db/index.js'

// ===== 类型定义 =====

export type ItemKind = 'news' | 'paper' | 'project' | 'tool' | 'app'

export interface FetchedItem {
  kind: ItemKind
  source: string
  sourceUrl: string
  title: string
  summary?: string
  content?: string
  url?: string
  coverImage?: string
  publishedAt?: Date
  metadata?: Record<string, unknown>
  /** 候选分类 slug,用于自动关联 categoryId(可选) */
  categorySlug?: string
}

export interface SyncSourceResult {
  source: string
  kind: ItemKind
  status: 'success' | 'failed' | 'partial'
  itemCount: number
  error?: string
  startedAt: Date
  finishedAt?: Date
}

// ===== 数据源配置 =====

/** RSSHub base URL(默认公共实例,生产建议自部署) */
function rsshub(path: string): string {
  const base = process.env.RSSHUB_URL?.replace(/\/$/, '') || 'https://rsshub.app'
  return `${base}${path}`
}

/** 国外官方 blog RSS(12 站) */
const RSS_FEEDS_OFFICIAL: Array<{ source: string; url: string; kind: ItemKind; categorySlug?: string }> = [
  { source: 'openai', url: 'https://openai.com/blog/rss.xml', kind: 'news', categorySlug: 'chat' },
  { source: 'anthropic', url: 'https://www.anthropic.com/news/rss.xml', kind: 'news', categorySlug: 'chat' },
  { source: 'deepmind', url: 'https://deepmind.google/blog/rss.xml', kind: 'news', categorySlug: 'multimodal' },
  { source: 'meta-ai', url: 'https://ai.meta.com/blog/rss/', kind: 'news', categorySlug: 'multimodal' },
  { source: 'microsoft-ai', url: 'https://blogs.microsoft.com/ai/feed/', kind: 'news', categorySlug: 'platform' },
  { source: 'huggingface-blog', url: 'https://huggingface.co/blog/feed.xml', kind: 'news', categorySlug: 'platform' },
  { source: 'stability-ai', url: 'https://stability.ai/news/rss.xml', kind: 'news', categorySlug: 'image' },
  { source: 'mistral-ai', url: 'https://mistral.ai/rss.xml', kind: 'news', categorySlug: 'chat' },
  { source: 'cohere', url: 'https://cohere.com/blog/rss.xml', kind: 'news', categorySlug: 'chat' },
  { source: 'nvidia-ai', url: 'https://blogs.nvidia.com/blog/category/deep-learning/feed/', kind: 'news', categorySlug: 'platform' },
  { source: 'google-research', url: 'https://research.google/blog/rss/', kind: 'news', categorySlug: 'multimodal' },
  { source: 'apple-ml', url: 'https://machinelearning.apple.com/rss.xml', kind: 'news', categorySlug: 'multimodal' },
]

/** 国外科技媒体 RSS(8 站) */
const RSS_FEEDS_MEDIA: Array<{ source: string; url: string; kind: ItemKind }> = [
  { source: 'techcrunch-ai', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', kind: 'news' },
  { source: 'the-verge-ai', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', kind: 'news' },
  { source: 'venturebeat-ai', url: 'https://venturebeat.com/category/ai/feed/', kind: 'news' },
  { source: 'mit-tech-review', url: 'https://www.technologyreview.com/feed/', kind: 'news' },
  { source: 'wired-ai', url: 'https://www.wired.com/feed/tag/ai/latest/rss', kind: 'news' },
  { source: 'ars-technica', url: 'https://feeds.arstechnica.com/arstechnica/features', kind: 'news' },
  { source: 'the-information', url: 'https://www.theinformation.com/feed/', kind: 'news' },
  { source: 'stratechery', url: 'https://stratechery.com/feed/', kind: 'news' },
]

/** 国内 AI 媒体 RSS(10 站,走 RSSHub) */
const RSS_FEEDS_CHINA: Array<{ source: string; url: string; kind: ItemKind }> = [
  { source: 'qbitai', url: rsshub('/qbitai/articles'), kind: 'news' },
  { source: 'jiqizhixin', url: rsshub('/jiqizhixin'), kind: 'news' },
  { source: 'xinzhiyuan', url: rsshub('/xinzhiyuan'), kind: 'news' },
  { source: 'aitechtalk', url: rsshub('/aitechtalk'), kind: 'news' },
  { source: 'paperweekly', url: rsshub('/paperweekly'), kind: 'news' },
  { source: 'aiqianxun', url: rsshub('/aiqianxun'), kind: 'news' },
  { source: 'infoq-ai', url: rsshub('/infoq/topic/ai'), kind: 'news' },
  { source: '36kr-ai', url: rsshub('/36kr/motif/452080'), kind: 'news' },
  { source: 'leiphone-ai', url: rsshub('/leiphone/ai'), kind: 'news' },
  { source: 'thepaper-ai', url: rsshub('/thepaper/channel/259'), kind: 'news' },
]

const RSS_FEEDS = [...RSS_FEEDS_OFFICIAL, ...RSS_FEEDS_MEDIA, ...RSS_FEEDS_CHINA]

/** arXiv 分类(cs.AI+CL+LG+CV+NE+stat.ML) */
const ARXIV_CATEGORIES = ['cs.AI', 'cs.CL', 'cs.LG', 'cs.CV', 'cs.NE', 'stat.ML']
const ARXIV_MAX_RESULTS = 60

/** Hugging Face Daily Papers */
const HF_PAPERS_URL = 'https://huggingface.co/papers'

/** GitHub Trending topics(12 个) */
const GITHUB_TOPICS = [
  'ai', 'llm', 'machine-learning', 'deep-learning', 'transformer',
  'chatbot', 'langchain', 'agent', 'stable-diffusion', 'gpt', 'rag', 'neural-network',
]
const GITHUB_MAX_RESULTS = 60

/** AI APP 元数据(35+ 国内外,按 category 分组) */
const AI_APPS: Array<{ source: string; name: string; url: string; category: string }> = [
  // 对话助手(15)
  { source: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com', category: 'chat' },
  { source: 'claude', name: 'Claude', url: 'https://claude.ai', category: 'chat' },
  { source: 'gemini', name: 'Gemini', url: 'https://gemini.google.com', category: 'chat' },
  { source: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com', category: 'chat' },
  { source: 'kimi', name: 'Kimi', url: 'https://kimi.moonshot.cn', category: 'chat' },
  { source: 'doubao', name: 'Doubao', url: 'https://www.doubao.com', category: 'chat' },
  { source: 'tongyi', name: 'Qwen', url: 'https://tongyi.aliyun.com', category: 'chat' },
  { source: 'wenxin', name: 'Wenxin', url: 'https://yiyan.baidu.com', category: 'chat' },
  { source: 'zhipu', name: 'Zhipu', url: 'https://chatglm.cn', category: 'chat' },
  { source: 'minimax', name: 'MiniMax', url: 'https://www.minimaxi.com', category: 'chat' },
  { source: 'baichuan', name: 'Baichuan', url: 'https://www.baichuan-ai.com', category: 'chat' },
  { source: 'yi', name: 'Yi', url: 'https://www.01.ai', category: 'chat' },
  { source: 'spark', name: 'Spark', url: 'https://xinghuo.xfyun.cn', category: 'chat' },
  { source: 'hunyuan', name: 'Hunyuan', url: 'https://hunyuan.tencent.com', category: 'chat' },
  { source: 'skywork', name: 'Skywork', url: 'https://chat.tiangong.cn', category: 'chat' },
  // 图像生成(6)
  { source: 'midjourney', name: 'Midjourney', url: 'https://www.midjourney.com', category: 'image' },
  { source: 'dalle', name: 'DALL·E', url: 'https://openai.com/dall-e-3', category: 'image' },
  { source: 'leonardo', name: 'Leonardo', url: 'https://leonardo.ai', category: 'image' },
  { source: 'ideogram', name: 'Ideogram', url: 'https://ideogram.ai', category: 'image' },
  { source: 'firefly', name: 'Adobe Firefly', url: 'https://www.adobe.com/products/firefly.html', category: 'image' },
  { source: 'civitai', name: 'Civitai', url: 'https://civitai.com', category: 'image' },
  // 视频生成(5)
  { source: 'sora', name: 'Sora', url: 'https://sora.com', category: 'video' },
  { source: 'runway', name: 'Runway', url: 'https://runwayml.com', category: 'video' },
  { source: 'pika', name: 'Pika', url: 'https://pika.art', category: 'video' },
  { source: 'heygen', name: 'HeyGen', url: 'https://www.heygen.com', category: 'video' },
  { source: 'synthesia', name: 'Synthesia', url: 'https://www.synthesia.io', category: 'video' },
  // 音频语音(4)
  { source: 'suno', name: 'Suno', url: 'https://suno.com', category: 'audio' },
  { source: 'elevenlabs-app', name: 'ElevenLabs', url: 'https://elevenlabs.io', category: 'audio' },
  { source: 'mubert', name: 'Mubert', url: 'https://mubert.com', category: 'audio' },
  { source: 'descript', name: 'Descript', url: 'https://www.descript.com', category: 'audio' },
  // 编程开发(4)
  { source: 'cursor', name: 'Cursor', url: 'https://cursor.com', category: 'code' },
  { source: 'copilot', name: 'GitHub Copilot', url: 'https://github.com/features/copilot', category: 'code' },
  { source: 'windsurf', name: 'Windsurf', url: 'https://codeium.com/windsurf', category: 'code' },
  { source: 'codeium', name: 'Codeium', url: 'https://codeium.com', category: 'code' },
  // 搜索问答(2)
  { source: 'perplexity-app', name: 'Perplexity', url: 'https://www.perplexity.ai', category: 'search' },
  { source: 'you-com', name: 'You.com', url: 'https://you.com', category: 'search' },
]

/** AI 工具元数据(35+ 国内外,按 category 分组) */
const AI_TOOLS: Array<{ source: string; name: string; url: string; category: string }> = [
  // 图像工具(5)
  { source: 'stable-diffusion', name: 'Stable Diffusion', url: 'https://stability.ai', category: 'image' },
  { source: 'flux', name: 'FLUX', url: 'https://blackforestlabs.ai', category: 'image' },
  { source: 'comfyui', name: 'ComfyUI', url: 'https://github.com/comfyanonymous/ComfyUI', category: 'image' },
  { source: 'automatic1111', name: 'AUTOMATIC1111', url: 'https://github.com/AUTOMATIC1111/stable-diffusion-webui', category: 'image' },
  { source: 'midjourney-tool', name: 'Midjourney', url: 'https://www.midjourney.com', category: 'image' },
  // 视频工具(2)
  { source: 'runway-tool', name: 'Runway', url: 'https://runwayml.com', category: 'video' },
  { source: 'hunyuan-video', name: 'Hunyuan Video', url: 'https://hunyuan.tencent.com', category: 'video' },
  // 音频工具(2)
  { source: 'elevenlabs', name: 'ElevenLabs', url: 'https://elevenlabs.io', category: 'audio' },
  { source: 'suno-tool', name: 'Suno', url: 'https://suno.com', category: 'audio' },
  // 开发平台(13)
  { source: 'huggingface', name: 'Hugging Face', url: 'https://huggingface.co', category: 'platform' },
  { source: 'replicate', name: 'Replicate', url: 'https://replicate.com', category: 'platform' },
  { source: 'together', name: 'Together AI', url: 'https://www.together.ai', category: 'platform' },
  { source: 'anyscale', name: 'Anyscale', url: 'https://www.anyscale.com', category: 'platform' },
  { source: 'fireworks', name: 'Fireworks AI', url: 'https://fireworks.ai', category: 'platform' },
  { source: 'openrouter', name: 'OpenRouter', url: 'https://openrouter.ai', category: 'platform' },
  { source: 'groq', name: 'Groq', url: 'https://groq.com', category: 'platform' },
  { source: 'mistral-platform', name: 'Mistral Platform', url: 'https://console.mistral.ai', category: 'platform' },
  { source: 'cohere-platform', name: 'Cohere Platform', url: 'https://dashboard.cohere.com', category: 'platform' },
  { source: 'bailian', name: '阿里百炼', url: 'https://bailian.console.aliyun.com', category: 'platform' },
  { source: 'volcengine-ark', name: '火山方舟', url: 'https://www.volcengine.com/product/ark', category: 'platform' },
  { source: 'qianfan', name: '百度千帆', url: 'https://qianfan.cloud.baidu.com', category: 'platform' },
  { source: 'zhipu-open', name: '智谱开放平台', url: 'https://open.bigmodel.cn', category: 'platform' },
  // 框架库(6)
  { source: 'langchain', name: 'LangChain', url: 'https://www.langchain.com', category: 'framework' },
  { source: 'llamaindex', name: 'LlamaIndex', url: 'https://www.llamaindex.ai', category: 'framework' },
  { source: 'crewai', name: 'CrewAI', url: 'https://www.crewai.com', category: 'framework' },
  { source: 'autogen', name: 'AutoGen', url: 'https://github.com/microsoft/autogen', category: 'framework' },
  { source: 'dspy', name: 'DSPy', url: 'https://github.com/stanfordnlp/dspy', category: 'framework' },
  { source: 'semantic-kernel', name: 'Semantic Kernel', url: 'https://github.com/microsoft/semantic-kernel', category: 'framework' },
  // 本地部署/推理(7)
  { source: 'vllm', name: 'vLLM', url: 'https://github.com/vllm-project/vllm', category: 'framework' },
  { source: 'ollama', name: 'Ollama', url: 'https://ollama.com', category: 'framework' },
  { source: 'lmstudio', name: 'LM Studio', url: 'https://lmstudio.ai', category: 'framework' },
  { source: 'localai', name: 'LocalAI', url: 'https://localai.io', category: 'framework' },
  { source: 'litellm', name: 'LiteLLM', url: 'https://github.com/BerriAI/litellm', category: 'framework' },
  { source: 'jan', name: 'Jan', url: 'https://jan.ai', category: 'framework' },
  { source: 'gpt4all', name: 'GPT4All', url: 'https://gpt4all.io', category: 'framework' },
]

// AI World 自定义分类(借鉴 ai-bot.cn 结构但重命名,不抄 slug)
export const AI_WORLD_CATEGORIES: Array<{ slug: string; name: string; description: string; icon: string; sort: number }> = [
  { slug: 'chat', name: '对话助手', description: '通用 AI 对话与聊天助手', icon: 'Bot', sort: 1 },
  { slug: 'image', name: '图像生成', description: 'AI 绘画、图像编辑与视觉创作', icon: 'Image', sort: 2 },
  { slug: 'video', name: '视频生成', description: 'AI 视频创作、剪辑与合成', icon: 'Video', sort: 3 },
  { slug: 'audio', name: '音频语音', description: 'AI 音乐、语音合成与音频处理', icon: 'Music', sort: 4 },
  { slug: 'code', name: '编程开发', description: 'AI 编程、代码生成与开发辅助', icon: 'Code', sort: 5 },
  { slug: 'search', name: '搜索问答', description: 'AI 搜索引擎与知识问答', icon: 'Search', sort: 6 },
  { slug: 'platform', name: '开发平台', description: 'AI 模型托管、训练与部署平台', icon: 'Cloud', sort: 7 },
  { slug: 'framework', name: '框架库', description: 'AI 应用开发框架与工具链', icon: 'Boxes', sort: 8 },
  { slug: 'multimodal', name: '多模态', description: '融合文本、图像、音频的多模态 AI', icon: 'Layers', sort: 9 },
  { slug: 'news', name: 'AI 资讯', description: 'AI 行业动态、官方博客与新闻', icon: 'Newspaper', sort: 10 },
  { slug: 'paper', name: 'AI 论文', description: 'arXiv 与 Hugging Face 每日论文', icon: 'FileText', sort: 11 },
  { slug: 'project', name: '开源项目', description: 'GitHub 趋势 AI 开源项目', icon: 'Github', sort: 12 },
]

// ===== 抓取器 =====

const rssParser = new RSSParser({
  timeout: 20000,
  headers: { 'User-Agent': 'IHUI-AI/1.0 AI-World-Sync' },
})

const fetchWithTimeout = async (url: string, opts: RequestInit = {}, timeoutMs = 20000): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** 清洗 HTML 标签 + 截断 */
function cleanText(html: string | undefined, maxLen = 1000): string | undefined {
  if (!html) return undefined
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return text ? text.slice(0, maxLen) : undefined
}

/** 抓 RSS feed(资讯类) */
async function fetchRssFeed(feed: { source: string; url: string; kind: ItemKind; categorySlug?: string }): Promise<FetchedItem[]> {
  const res = await fetchWithTimeout(feed.url)
  if (!res.ok) throw new Error(`RSS ${feed.source} HTTP ${res.status}`)
  const xml = await res.text()
  const parsed = await rssParser.parseString(xml)
  return (parsed.items ?? []).slice(0, 30).map((item) => ({
    kind: feed.kind,
    source: feed.source,
    sourceUrl: item.link ?? item.guid ?? feed.url,
    title: (item.title ?? 'Untitled').trim().slice(0, 500),
    summary: cleanText(item.contentSnippet ?? item.content, 1000),
    content: cleanText(item.content, 5000),
    url: item.link ?? undefined,
    coverImage: item.enclosure?.url ?? undefined,
    publishedAt: item.isoDate ? new Date(item.isoDate) : undefined,
    metadata: { author: item.creator, categories: item.categories },
    categorySlug: feed.categorySlug,
  }))
}

/** 抓 arXiv 论文(多分类合并) */
async function fetchArxivPapers(): Promise<FetchedItem[]> {
  const searchQuery = ARXIV_CATEGORIES.map((c) => `cat:${c}`).join('+OR+')
  const url = `http://export.arxiv.org/api/query?search_query=${searchQuery}&sortBy=submittedDate&sortOrder=descending&max_results=${ARXIV_MAX_RESULTS}`
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`arXiv HTTP ${res.status}`)
  const xml = await res.text()
  const parsed = await rssParser.parseString(xml)
  return (parsed.items ?? []).map((item) => ({
    kind: 'paper' as const,
    source: 'arxiv',
    sourceUrl: item.link ?? item.guid ?? '',
    title: (item.title ?? 'Untitled').trim().slice(0, 500),
    summary: cleanText(item.contentSnippet, 1000),
    content: cleanText(item.content, 5000),
    url: item.link ?? undefined,
    publishedAt: item.isoDate ? new Date(item.isoDate) : undefined,
    metadata: { authors: item.creator, categories: item.categories },
    categorySlug: 'paper',
  }))
}

/** 抓 Hugging Face Daily Papers(HTML 解析) */
async function fetchHuggingfacePapers(): Promise<FetchedItem[]> {
  const res = await fetchWithTimeout(HF_PAPERS_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IHUI-AI/1.0 AI-World-Sync)' },
  })
  if (!res.ok) throw new Error(`HF Papers HTTP ${res.status}`)
  const html = await res.text()
  const $ = cheerio.load(html)
  const items: FetchedItem[] = []
  $('article').slice(0, 30).each((_, el) => {
    const $el = $(el)
    const title = $el.find('h3 a, h3, a[href*="/papers/"]').first().text().trim()
    const href = $el.find('a[href*="/papers/"]').first().attr('href')
    const summary = $el.find('p, .summary, [class*="summary"]').first().text().trim()
    if (!title || !href) return
    const url = href.startsWith('http') ? href : `https://huggingface.co${href}`
    items.push({
      kind: 'paper',
      source: 'huggingface-papers',
      sourceUrl: url,
      title: title.slice(0, 500),
      summary: summary.slice(0, 1000) || undefined,
      url,
      publishedAt: new Date(),
      metadata: { dailyFeatured: true },
      categorySlug: 'paper',
    })
  })
  return items
}

/** 抓 GitHub Trending(用 search/repositories API,串行避免 rate limit) */
async function fetchGithubTrending(): Promise<FetchedItem[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const perPage = Math.ceil(GITHUB_MAX_RESULTS / GITHUB_TOPICS.length)
  const items: FetchedItem[] = []
  // 串行避免 GitHub API rate limit(未授权 60 次/小时)
  for (const topic of GITHUB_TOPICS) {
    try {
      const url = `https://api.github.com/search/repositories?q=topic:${topic}+pushed:>${since}&sort=stars&order=desc&per_page=${perPage}`
      const res = await fetchWithTimeout(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'IHUI-AI/1.0 AI-World-Sync',
        },
      }, 15000)
      if (!res.ok) {
        // rate limit 或其他错误,跳过此 topic 继续下一个
        console.warn(`[ai-world-sync] github topic=${topic} HTTP ${res.status}, skip`)
        continue
      }
      const data = (await res.json()) as { items?: Array<Record<string, unknown>> }
      for (const repo of data.items ?? []) {
        const htmlUrl = String(repo.html_url ?? '')
        if (!htmlUrl) continue
        const description = repo.description ? String(repo.description) : undefined
        items.push({
          kind: 'project',
          source: 'github',
          sourceUrl: htmlUrl,
          title: String(repo.full_name ?? repo.name ?? 'Untitled'),
          summary: description?.slice(0, 1000),
          url: htmlUrl,
          coverImage: repo.owner && typeof repo.owner === 'object' && 'avatar_url' in repo.owner
            ? String((repo.owner as Record<string, unknown>).avatar_url)
            : undefined,
          publishedAt: repo.pushed_at ? new Date(String(repo.pushed_at)) : undefined,
          metadata: {
            stars: repo.stargazers_count,
            language: repo.language,
            topics: repo.topics,
            forks: repo.forks_count,
          },
          categorySlug: 'project',
        })
      }
    } catch (err) {
      console.warn(`[ai-world-sync] github topic=${topic} error:`, err instanceof Error ? err.message : err)
    }
  }
  // 去重(同 sourceUrl)
  const seen = new Set<string>()
  return items.filter((it) => {
    if (seen.has(it.sourceUrl)) return false
    seen.add(it.sourceUrl)
    return true
  }).slice(0, GITHUB_MAX_RESULTS)
}

/** 抓 AI APP / Tool 官网元数据(只取 title + meta description,不抓 ai-bot.cn) */
async function fetchSiteMeta(entry: { source: string; name: string; url: string; category: string }, kind: ItemKind): Promise<FetchedItem> {
  const res = await fetchWithTimeout(entry.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IHUI-AI/1.0 AI-World-Sync)' },
  }, 15000)
  if (!res.ok) throw new Error(`${entry.name} HTTP ${res.status}`)
  const html = await res.text()
  const $ = cheerio.load(html)
  const title = $('title').first().text().trim() || entry.name
  const description = $('meta[name="description"]').attr('content')?.trim()
    || $('meta[property="og:description"]').attr('content')?.trim()
    || ''
  const ogImage = $('meta[property="og:image"]').attr('content') ?? undefined
  return {
    kind,
    source: entry.source,
    sourceUrl: entry.url,
    title: entry.name,
    summary: description.slice(0, 1000) || `${entry.name} 官方网站`,
    url: entry.url,
    coverImage: ogImage,
    metadata: { category: entry.category, siteTitle: title },
    categorySlug: entry.category,
  }
}

// ===== LLM 改写(用项目内 AI_SERVICE_URL,失败降级) =====

/** LLM 异常静默标志(首次失败打印,后续静默避免日志污染) */
let llmErrorLogged = false

/** 每轮 sync 开始时重置 LLM 日志标志 */
function resetLlmErrorFlag(): void {
  llmErrorLogged = false
}

/**
 * 调用项目内 ai-service 的 /llm/complete 接口
 * 与 ai-feed-service.ts callLlm 保持一致
 */
async function callLlm(prompt: string, content: string, timeoutMs = 15000): Promise<string | null> {
  const baseUrl = process.env.AI_SERVICE_URL
  if (!baseUrl) return null
  try {
    const res = await fetchWithTimeout(`${baseUrl}/llm/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, content }),
    }, timeoutMs)
    if (!res.ok) {
      if (!llmErrorLogged) {
        console.warn(`[ai-world-sync] LLM 调用失败 status=${res.status}(后续静默)`)
        llmErrorLogged = true
      }
      return null
    }
    const json = (await res.json()) as { data?: { content?: string } | string; content?: string }
    const text =
      typeof json.data === 'string' ? json.data : (json.data?.content ?? json.content ?? '')
    return text.trim() || null
  } catch (err) {
    if (!llmErrorLogged) {
      console.warn(`[ai-world-sync] LLM 调用异常(后续静默):`, err instanceof Error ? err.message : err)
      llmErrorLogged = true
    }
    return null
  }
}

/** 用 LLM 改写摘要(失败降级用原始摘要) */
async function rewriteSummaryWithLLM(item: FetchedItem): Promise<string | undefined> {
  if (!item.summary) return item.summary
  // 仅对资讯/论文改写,APP/Tool/Project 用原始 description
  if (item.kind !== 'news' && item.kind !== 'paper') return item.summary
  const prompt = `你是一名 AI 行业编辑。请将以下${item.kind === 'paper' ? '论文' : '资讯'}摘要改写为简洁的中文摘要(150字以内),保留关键信息,去除营销话术,不要添加评论:`
  const rewritten = await callLlm(prompt, item.summary)
  return rewritten ?? item.summary
}

// ===== 数据库操作 =====

/** 缓存 categoryId(避免每次 upsert 都查) */
const categoryIdCache = new Map<string, string | null>()

/** 确保分类存在(首次同步时初始化) */
export async function ensureCategories(): Promise<void> {
  for (const cat of AI_WORLD_CATEGORIES) {
    const existing = await db
      .select({ id: aiWorldCategories.id })
      .from(aiWorldCategories)
      .where(eq(aiWorldCategories.slug, cat.slug))
      .limit(1)
    if (existing.length === 0) {
      await db.insert(aiWorldCategories).values({
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        sort: cat.sort,
        status: 1,
      }).onConflictDoNothing()
    }
  }
  // 预热缓存(limit 100 保证覆盖所有分类)
  const allCats = await db.select({ id: aiWorldCategories.id, slug: aiWorldCategories.slug }).from(aiWorldCategories).limit(100)
  for (const c of allCats) categoryIdCache.set(c.slug, c.id)
}

/** 通过 slug 查分类 ID(走缓存) */
async function getCategoryIdBySlug(slug: string): Promise<string | null> {
  if (categoryIdCache.has(slug)) return categoryIdCache.get(slug) ?? null
  const rows = await db
    .select({ id: aiWorldCategories.id })
    .from(aiWorldCategories)
    .where(eq(aiWorldCategories.slug, slug))
    .limit(1)
  const id = rows[0]?.id ?? null
  categoryIdCache.set(slug, id)
  return id
}

// 保留导出供未来扩展使用(如按分类聚合 items)
export { getCategoryIdBySlug }

/** 跨源去重缓存(同 title 在同一轮 sync 内只保留首个) */
const seenTitlesInRound = new Set<string>()

/** upsert 结果:区分新增/更新/去重跳过/错误,便于日志准确统计 */
type UpsertResult = 'inserted' | 'updated' | 'skipped' | 'error'

/** upsert 单个 item(kind + sourceUrl 唯一) */
async function upsertItem(item: FetchedItem): Promise<UpsertResult> {
  if (!item.sourceUrl) return 'error'
  // 跨源去重(同 title 视为重复,避免不同源转载同一资讯)
  const titleKey = item.title.trim().toLowerCase().slice(0, 200)
  if (titleKey && seenTitlesInRound.has(titleKey)) return 'skipped'
  if (titleKey) seenTitlesInRound.add(titleKey)

  // 并行:LLM 改写 + 分类关联
  const [summary, categoryId] = await Promise.all([
    rewriteSummaryWithLLM(item),
    item.categorySlug ? getCategoryIdBySlug(item.categorySlug) : Promise.resolve(null),
  ])

  const existing = await db
    .select({ id: aiWorldItems.id })
    .from(aiWorldItems)
    .where(and(
      eq(aiWorldItems.kind, item.kind),
      eq(aiWorldItems.sourceUrl, item.sourceUrl),
    ))
    .limit(1)
  const payload: NewAiWorldItem = {
    kind: item.kind,
    categoryId,
    slug: null,
    title: item.title.slice(0, 500),
    summary: summary?.slice(0, 1000),
    content: item.content,
    url: item.url,
    coverImage: item.coverImage,
    source: item.source,
    sourceUrl: item.sourceUrl,
    publishedAt: item.publishedAt,
    fetchedAt: new Date(),
    metadata: item.metadata ?? {},
    status: 1,
  }
  if (existing.length > 0) {
    const existingId = existing[0]!.id
    await db
      .update(aiWorldItems)
      .set({
        title: payload.title,
        summary: payload.summary,
        content: payload.content,
        url: payload.url,
        coverImage: payload.coverImage,
        categoryId: payload.categoryId,
        publishedAt: payload.publishedAt,
        fetchedAt: payload.fetchedAt,
        metadata: payload.metadata,
        updatedAt: new Date(),
      })
      .where(eq(aiWorldItems.id, existingId))
    return 'updated'
  }
  await db.insert(aiWorldItems).values(payload).onConflictDoNothing()
  return 'inserted'
}

/** 写同步日志 */
async function writeSyncLog(result: SyncSourceResult): Promise<void> {
  await db.insert(aiWorldSyncLog).values({
    source: result.source,
    kind: result.kind,
    status: result.status,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt ?? new Date(),
    itemCount: result.itemCount,
    error: result.error,
  })
}

// ===== 同步主流程 =====

const MAX_RETRY = 3

async function syncOneSourceWithRetry(
  source: string,
  kind: ItemKind,
  fetcher: () => Promise<FetchedItem[]>,
): Promise<SyncSourceResult> {
  const startedAt = new Date()
  let lastError: string | undefined
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const items = await fetcher()
      let successCount = 0
      let skippedCount = 0
      let failCount = 0
      for (const item of items) {
        try {
          const result = await upsertItem(item)
          if (result === 'inserted' || result === 'updated') successCount++
          else if (result === 'skipped') skippedCount++
          else failCount++
        } catch {
          failCount++
        }
      }
      // status:全失败且 items>0 → failed;有成功有失败 → partial;否则 success
      const status: SyncSourceResult['status'] = successCount === 0 && items.length > 0
        ? 'failed'
        : failCount > 0
          ? 'partial'
          : 'success'
      const errorParts: string[] = []
      if (failCount > 0) errorParts.push(`${failCount} failed`)
      if (skippedCount > 0) errorParts.push(`${skippedCount} skipped(dedup)`)
      const result: SyncSourceResult = {
        source, kind, status, itemCount: successCount, startedAt, finishedAt: new Date(),
        error: errorParts.length > 0 ? errorParts.join(', ') : undefined,
      }
      await writeSyncLog(result)
      return result
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      if (attempt < MAX_RETRY) {
        await new Promise((r) => setTimeout(r, 1000 * attempt))
      }
    }
  }
  const failed: SyncSourceResult = {
    source, kind, status: 'failed', itemCount: 0, startedAt, finishedAt: new Date(), error: lastError,
  }
  await writeSyncLog(failed)
  return failed
}

/** 同步所有源(分阶段并行 + 串行混合,GitHub 串行避免 rate limit) */
export async function syncAllSources(): Promise<SyncSourceResult[]> {
  // 每轮开始清空去重缓存 + 重置 LLM 日志标志
  seenTitlesInRound.clear()
  resetLlmErrorFlag()
  // 预热分类缓存
  await ensureCategories()

  const results: SyncSourceResult[] = []

  // 1. RSS 资讯(30 源,分批并行避免连接数爆炸,每批 10 个)
  const RSS_BATCH = 10
  for (let i = 0; i < RSS_FEEDS.length; i += RSS_BATCH) {
    const batch = RSS_FEEDS.slice(i, i + RSS_BATCH)
    const batchResults = await Promise.all(
      batch.map((feed) => syncOneSourceWithRetry(feed.source, feed.kind, () => fetchRssFeed(feed))),
    )
    results.push(...batchResults)
  }

  // 2. arXiv 论文(6 分类合并查询)
  results.push(await syncOneSourceWithRetry('arxiv', 'paper', fetchArxivPapers))

  // 3. Hugging Face Daily Papers
  results.push(await syncOneSourceWithRetry('huggingface-papers', 'paper', fetchHuggingfacePapers))

  // 4. GitHub Trending(内部串行,避免 rate limit)
  results.push(await syncOneSourceWithRetry('github', 'project', fetchGithubTrending))

  // 5. AI APP 元数据(35+,分批并行)
  const APP_BATCH = 8
  for (let i = 0; i < AI_APPS.length; i += APP_BATCH) {
    const batch = AI_APPS.slice(i, i + APP_BATCH)
    const batchResults = await Promise.all(
      batch.map((entry) => syncOneSourceWithRetry(entry.source, 'app', async () => [await fetchSiteMeta(entry, 'app')])),
    )
    results.push(...batchResults)
  }

  // 6. AI 工具元数据(35+,分批并行)
  const TOOL_BATCH = 8
  for (let i = 0; i < AI_TOOLS.length; i += TOOL_BATCH) {
    const batch = AI_TOOLS.slice(i, i + TOOL_BATCH)
    const batchResults = await Promise.all(
      batch.map((entry) => syncOneSourceWithRetry(entry.source, 'tool', async () => [await fetchSiteMeta(entry, 'tool')])),
    )
    results.push(...batchResults)
  }

  return results
}

/** 统计信源数量(供 /sync/logs 接口展示) */
export function getSourceStats(): { rss: number; arxiv: number; github: number; apps: number; tools: number; total: number } {
  return {
    rss: RSS_FEEDS.length,
    arxiv: ARXIV_CATEGORIES.length,
    github: GITHUB_TOPICS.length,
    apps: AI_APPS.length,
    tools: AI_TOOLS.length,
    total: RSS_FEEDS.length + 1 + 1 + GITHUB_TOPICS.length + AI_APPS.length + AI_TOOLS.length,
  }
}

// ===== 调度器 =====

let scheduledTask: ScheduledTask | null = null

/** 启动定时任务(在 server.ts 注册) */
export function startAiWorldSyncScheduler(): void {
  if (scheduledTask) return
  // 每日 0 点 + 12 点(对应 12 小时间隔)
  scheduledTask = cron.schedule('0 0,12 * * *', async () => {
    try {
      const results = await syncAllSources()
      const ok = results.filter((r) => r.status === 'success').length
      const partial = results.filter((r) => r.status === 'partial').length
      const fail = results.filter((r) => r.status === 'failed').length
      const totalItems = results.reduce((sum, r) => sum + r.itemCount, 0)
      console.log(`[ai-world-sync] done: ${ok} success, ${partial} partial, ${fail} failed, ${totalItems} items`)
    } catch (err) {
      console.error('[ai-world-sync] fatal:', err)
    }
  }, {
    timezone: 'Asia/Shanghai',
  })
  console.log('[ai-world-sync] scheduler started (cron: 0 0,12 * * * Asia/Shanghai)')
}

/** 停止定时任务 */
export function stopAiWorldSyncScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
  }
}

// ===== CLI 入口(--run-once 手动触发) =====

// 检测 CLI 调用:tsx apps/api/src/jobs/ai-world-sync.ts --run-once
const isCli = process.argv[1]?.endsWith('ai-world-sync.ts') || process.argv[1]?.endsWith('ai-world-sync.js')
if (isCli && process.argv.includes('--run-once')) {
  ;(async () => {
    try {
      console.log('[ai-world-sync] run-once start')
      const stats = getSourceStats()
      console.log(`[ai-world-sync] sources: rss=${stats.rss} arxiv=${stats.arxiv} github=${stats.github} apps=${stats.apps} tools=${stats.tools} total=${stats.total}`)
      const results = await syncAllSources()
      const ok = results.filter((r) => r.status === 'success').length
      const partial = results.filter((r) => r.status === 'partial').length
      const fail = results.filter((r) => r.status === 'failed').length
      const totalItems = results.reduce((sum, r) => sum + r.itemCount, 0)
      console.log(`[ai-world-sync] run-once done: ${ok} success, ${partial} partial, ${fail} failed, ${totalItems} items`)
      for (const r of results) {
        console.log(`  - ${r.source} (${r.kind}): ${r.status} items=${r.itemCount}${r.error ? ` err=${r.error}` : ''}`)
      }
      process.exit(0)
    } catch (err) {
      console.error('[ai-world-sync] run-once fatal:', err)
      process.exit(1)
    }
  })()
}
