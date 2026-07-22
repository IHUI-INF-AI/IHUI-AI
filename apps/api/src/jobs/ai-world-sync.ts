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
import { and, eq, sql } from 'drizzle-orm'
import {
  aiWorldCategories,
  aiWorldItems,
  aiWorldRankings,
  aiWorldSyncLog,
  type NewAiWorldItem,
  type NewAiWorldRanking,
} from '@ihui/database'

import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'

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
  kind: ItemKind | 'ranking' | 'trending'
  status: 'success' | 'failed' | 'partial'
  itemCount: number
  error?: string
  startedAt: Date
  finishedAt?: Date
}

// ===== 模型排行榜类型定义(2026-07-22 新增,5 大权威榜单) =====

export type LeaderboardId = 'lmsys' | 'opencompass' | 'hf-open-llm' | 'superclue' | 'artificial-analysis'

export interface LeaderboardEntry {
  leaderboard: LeaderboardId
  category: string // 'overall' | 'coding' | 'math' | 'reasoning' | 'chinese' | 'english' | 'multiturn' | 'hard-prompts'
  rank: number
  modelName: string
  provider?: string
  score?: string
  scores?: Record<string, unknown> // {elo, ci_lower, ci_upper, votes, organization, license}
  publishedAt?: Date
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

// ===== AI 仓库 GitHub 映射(为有 GitHub 仓库的工具/APP 抓 stars/forks,2026-07-22 新增) =====
// 从 AI_TOOLS + AI_APPS 中筛选 url 含 'github.com' 的项,提取 owner/repo
const AI_REPOS_GITHUB: Array<{ source: string; kind: ItemKind; owner: string; repo: string }> = [
  { source: 'comfyui', kind: 'tool', owner: 'comfyanonymous', repo: 'ComfyUI' },
  { source: 'automatic1111', kind: 'tool', owner: 'AUTOMATIC1111', repo: 'stable-diffusion-webui' },
  { source: 'autogen', kind: 'tool', owner: 'microsoft', repo: 'autogen' },
  { source: 'dspy', kind: 'tool', owner: 'stanfordnlp', repo: 'dspy' },
  { source: 'semantic-kernel', kind: 'tool', owner: 'microsoft', repo: 'semantic-kernel' },
  { source: 'vllm', kind: 'tool', owner: 'vllm-project', repo: 'vllm' },
  { source: 'litellm', kind: 'tool', owner: 'BerriAI', repo: 'litellm' },
  // copilot-docs 为 GitHub 官方文档仓库,可反映 Copilot 受关注度(可选)
  { source: 'copilot', kind: 'app', owner: 'github', repo: 'copilot-docs' },
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
        logger.warn(`[ai-world-sync] github topic=${topic} HTTP ${res.status}, skip`)
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
      logger.warn(`[ai-world-sync] github topic=${topic} error:`, { error: err instanceof Error ? err.message : err })
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
    const res = await aiServiceFetch(null, '/llm/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, content }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) {
      if (!llmErrorLogged) {
        logger.warn(`[ai-world-sync] LLM 调用失败 status=${res.status}(后续静默)`)
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
      logger.warn(`[ai-world-sync] LLM 调用异常(后续静默):`, { error: err instanceof Error ? err.message : err })
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

  // 7. 模型排行榜(5 大权威榜单,2026-07-22 新增)
  results.push(...await syncRankings())
  // 8. 热度更新(GitHub stars/forks + LLM 综合分,2026-07-22 新增)
  results.push(...await syncTrendingMetrics())

  return results
}

/** 统计信源数量(供 /sync/logs 接口展示,2026-07-22 扩充 rankings + trending) */
export function getSourceStats(): { rss: number; arxiv: number; github: number; apps: number; tools: number; rankings: number; trending: number; total: number } {
  // rankings:5 大权威榜单(lmsys / opencompass / hf-open-llm / superclue / artificial-analysis)
  const rankingsCount = 5
  // trending:有 GitHub 仓库的 AI 工具/APP 数量
  const trendingCount = AI_REPOS_GITHUB.length
  return {
    rss: RSS_FEEDS.length,
    arxiv: ARXIV_CATEGORIES.length,
    github: GITHUB_TOPICS.length,
    apps: AI_APPS.length,
    tools: AI_TOOLS.length,
    rankings: rankingsCount,
    trending: trendingCount,
    total: RSS_FEEDS.length + 1 + 1 + GITHUB_TOPICS.length + AI_APPS.length + AI_TOOLS.length + rankingsCount + trendingCount,
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
      logger.info(`[ai-world-sync] done: ${ok} success, ${partial} partial, ${fail} failed, ${totalItems} items`)
    } catch (err) {
      logger.error('[ai-world-sync] fatal:', { error: err })
    }
  }, {
    timezone: 'Asia/Shanghai',
  })
  logger.info('[ai-world-sync] scheduler started (cron: 0 0,12 * * * Asia/Shanghai)')
}

/** 停止定时任务 */
export function stopAiWorldSyncScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
  }
}

// ===== 模型排行榜抓取器(2026-07-22 新增,5 大权威榜单) =====
//
// 5 大权威模型排行榜抓取器(2026-07-22 生产可用版)
// 数据源调研结果:
//   LMSYS/LMArena: https://lmarena.ai/leaderboard — HTML 表格,672 模型,8 子分类 ✅
//   HF Open LLM: HuggingFace datasets-server API — 模型评测结果 JSON ✅
//   Artificial Analysis: https://artificialanalysis.ai/models — Next.js RSC 数据 ⚠️
//   OpenCompass: 网站 JS 渲染无公开 API → 降级空 ❌
//   SuperCLUE: 网站 JS 渲染无公开 API → 降级空 ❌
// 设计原则:每个抓取器独立失败不阻塞,返回空数组 + logger.warn

const LEADERBOARD_USER_AGENT = 'Mozilla/5.0 (compatible; IHUI-AI/1.0 AI-World-Sync)'

/** 从 HTML 表格行提取数据,返回字符串二维数组(每行一个 cells 数组) */
function extractTableRows($: cheerio.CheerioAPI, maxRows = 30): string[][] {
  const rows: string[][] = []
  const selectors = [
    'table tbody tr',
    'table thead + tbody tr',
    '.table tbody tr',
    '[class*="leaderboard"] table tbody tr',
    '[class*="table"] tbody tr',
  ]
  for (const sel of selectors) {
    $(sel).each((_, tr) => {
      const cells: string[] = []
      $(tr).find('td').each((_, td) => {
        cells.push($(td).text().trim())
      })
      if (cells.length >= 2) rows.push(cells)
    })
    if (rows.length > 0) break
  }
  return rows.slice(0, maxRows)
}

/** LMArena 子分类映射(表头 → category slug) */
const LMARENA_CATEGORIES = [
  'overall',      // Overall
  'expert',       // Expert
  'hard-prompts', // Hard Prompts
  'coding',       // Coding
  'math',         // Math
  'creative',     // Creative Writing
  'instruction',  // Instruction Following
  'longer-query', // Longer Query
] as const

/**
 * 抓 LMArena(原 LMSYS Chatbot Arena)排行榜
 * 数据源:https://lmarena.ai/leaderboard — HTML 表格,672 模型,8 子分类
 * 表格结构:第 0 行表头(Model | Overall | Expert | Hard Prompts | Coding | Math | Creative Writing | Instruction Following | Longer Query)
 * 第 1+ 行:Provider+Model | rank_overall | rank_expert | ... | rank_longer_query
 * Provider+Model 格式如 "Anthropicclaude-fable-5" → provider="Anthropic", model="claude-fable-5"
 */
async function fetchLMSYSArena(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetchWithTimeout(
      'https://lmarena.ai/leaderboard',
      { headers: { 'User-Agent': LEADERBOARD_USER_AGENT, Accept: 'text/html' } },
      30000,
    )
    if (!res.ok) {
      logger.warn(`[ai-world-sync] LMArena leaderboard HTTP ${res.status}, skip`)
      return []
    }
    const html = await res.text()
    const $ = cheerio.load(html)
    const rows = extractTableRows($, 200) // LMArena 有 672 行,取前 200
    if (rows.length === 0) {
      logger.warn('[ai-world-sync] LMArena leaderboard no table rows, skip')
      return []
    }
    const entries: LeaderboardEntry[] = []
    const now = new Date()
    rows.forEach((cells) => {
      // 第 0 列是 "Provider+Model" 拼接(如 "Anthropicclaude-fable-5")
      const rawName = (cells[0] ?? '').trim()
      if (!rawName || rawName === 'Model') return
      // 尝试分离 provider 和 model:找已知 provider 前缀
      const knownProviders = ['Anthropic', 'OpenAI', 'Google', 'Meta', 'Mistral', 'Cohere', 'Alibaba', 'Baidu', 'Tencent', 'ByteDance', 'DeepSeek', 'Nvidia', 'Microsoft', 'Amazon', 'Apple', 'Samsung', 'xAI', 'Perplexity', 'Reka', 'Zhipu', 'Minimax', 'Baichuan', 'Yi', '01-AI', 'HuggingFace', 'Together', 'Anyscale', 'Saama', 'Nomic', 'Databricks']
      let provider: string | undefined
      let modelName: string = rawName
      for (const p of knownProviders) {
        if (rawName.startsWith(p)) {
          provider = p
          modelName = rawName.slice(p.length)
          break
        }
      }
      // 如果没匹配到 provider,用首字母大写部分作 provider
      if (!provider) {
        const match = rawName.match(/^([A-Z][a-z]+)(.+)/)
        if (match && match[1] && match[2]) {
          provider = match[1]
          modelName = match[2]
        }
      }
      // 8 个子分类各取 rank(cells[1]-cells[8])
      for (let catIdx = 0; catIdx < LMARENA_CATEGORIES.length && catIdx + 1 < cells.length; catIdx++) {
        const category = LMARENA_CATEGORIES[catIdx]
        if (!category) continue
        const rankStr = cells[catIdx + 1]?.trim() ?? ''
        const rank = parseInt(rankStr.replace(/[^\d]/g, ''), 10)
        if (!Number.isFinite(rank) || rank <= 0) continue
        // 只取 overall top 50 + 其他子分类 top 20(避免数据量过大)
        const maxRank = catIdx === 0 ? 50 : 20
        if (rank > maxRank) continue
        entries.push({
          leaderboard: 'lmsys',
          category,
          rank,
          modelName: modelName.slice(0, 200),
          provider,
          score: rankStr,
          scores: { rank, source: 'lmarena-ai' },
          publishedAt: now,
        })
      }
    })
    logger.info(`[ai-world-sync] LMArena fetched ${entries.length} entries from ${rows.length} rows`)
    return entries
  } catch (err) {
    logger.warn('[ai-world-sync] LMArena leaderboard error:', { error: err instanceof Error ? err.message : err })
    return []
  }
}

/**
 * 抓 OpenCompass 司南(中文榜单)
 * 数据源:https://rank.opencompass.org.cn/leaderboard/llm — Vue SPA,JS 渲染
 * 后端 API 受 nginx WAF 保护返回 405,无法直接 HTTP 抓取
 * 方案:调用 ai-service 的 /api/opencompass/scrape 端点(Playwright headless 渲染)
 * 失败降级:返回空数组,不阻塞其他榜单
 * 2026-07-22 立:从降级空改为 Playwright 渲染抓取 + 多分类拆分(7 类),生产可用
 */
const OPENCOMPASS_SUBSCORE_MAP: Record<string, string> = {
  '语言': 'chinese', 'chinese': 'chinese', 'Chinese': 'chinese',
  '英文': 'english', 'english': 'english', 'English': 'english',
  '知识': 'knowledge', 'knowledge': 'knowledge', 'Knowledge': 'knowledge',
  '推理': 'reasoning', 'reasoning': 'reasoning', 'Reasoning': 'reasoning',
  '数学': 'math', 'math': 'math', 'Math': 'math',
  '代码': 'coding', 'coding': 'coding', 'Coding': 'coding',
  '智能体': 'agent', 'agent': 'agent', 'Agent': 'agent',
}
async function fetchOpenCompass(): Promise<LeaderboardEntry[]> {
  const baseUrl = process.env.AI_SERVICE_URL
  if (!baseUrl) {
    logger.warn('[ai-world-sync] AI_SERVICE_URL 未配置,OpenCompass 跳过')
    return []
  }
  try {
    const res = await aiServiceFetch(null, '/api/opencompass/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(180000), // Playwright 渲染 OpenCompass 司南 SPA 较慢,180s 超时
    })
    if (!res.ok) {
      logger.warn(`[ai-world-sync] OpenCompass scrape HTTP ${res.status}, skip`)
      return []
    }
    const json = (await res.json()) as {
      code: number
      message: string
      data?: {
        entries?: Array<{
          leaderboard: string
          category: string
          rank: number
          modelName: string
          provider?: string | null
          score?: string | null
          scores?: Record<string, unknown> | null
          publishedAt?: string | null
        }>
        captured_at?: number
        url?: string
        headers?: string[]
      }
    }
    if (json.code !== 0 || !json.data?.entries) {
      logger.warn(`[ai-world-sync] OpenCompass scrape failed: ${json.message}`)
      return []
    }
    const fallbackDate = json.data.captured_at ? new Date(json.data.captured_at) : new Date()
    const rawEntries = json.data.entries.map((e) => {
      let publishedAt = fallbackDate
      if (e.publishedAt) {
        const parsed = new Date(e.publishedAt)
        if (!Number.isNaN(parsed.getTime())) publishedAt = parsed
      }
      return {
        leaderboard: 'opencompass' as const,
        category: e.category || 'overall',
        rank: e.rank,
        modelName: e.modelName,
        provider: e.provider ?? undefined,
        score: e.score ?? undefined,
        scores: e.scores ?? undefined,
        publishedAt,
      }
    })
    // 多分类拆分:每条 entry 的 scores 中匹配 OPENCOMPASS_SUBSCORE_MAP 的子分数 → 拆出独立条目
    const byCat: Record<string, Array<{ modelName: string; provider?: string; subScore: number; scores: Record<string, unknown>; publishedAt: Date }>> = {}
    for (const entry of rawEntries) {
      if (!entry.scores) continue
      for (const [k, v] of Object.entries(entry.scores)) {
        if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue
        const cat = OPENCOMPASS_SUBSCORE_MAP[k]
        if (!cat) continue
        if (!byCat[cat]) byCat[cat] = []
        byCat[cat].push({
          modelName: entry.modelName,
          provider: entry.provider,
          subScore: v,
          scores: { ...entry.scores, source: 'opencompass' },
          publishedAt: entry.publishedAt ?? fallbackDate,
        })
      }
    }
    const entries: LeaderboardEntry[] = [...rawEntries]
    for (const [cat, items] of Object.entries(byCat)) {
      items.sort((a, b) => b.subScore - a.subScore)
      const top = items.slice(0, 30)
      for (let i = 0; i < top.length; i++) {
        const it = top[i]!
        entries.push({
          leaderboard: 'opencompass',
          category: cat,
          rank: i + 1,
          modelName: it.modelName.slice(0, 200),
          provider: it.provider,
          score: it.subScore.toFixed(2),
          scores: it.scores,
          publishedAt: it.publishedAt,
        })
      }
    }
    const catCount: Record<string, number> = {}
    for (const e of entries) catCount[e.category] = (catCount[e.category] ?? 0) + 1
    logger.info(`[ai-world-sync] OpenCompass fetched ${entries.length} entries across ${Object.keys(catCount).length} categories: ${JSON.stringify(catCount)}`)
    return entries
  } catch (err) {
    logger.warn('[ai-world-sync] OpenCompass scrape error:', { error: err instanceof Error ? err.message : err })
    return []
  }
}

/**
 * 抓 HuggingFace 热门开源模型榜(原 Open LLM Leaderboard)
 * 数据源(2026-07-22 变更):HF Hub models API,按 downloads 降序取 top 100
 * 原因:open-llm-leaderboard/results 的 datasets-server rows API 因 schema cast 失败返回 500
 * 新源稳定可靠:https://huggingface.co/api/models?sort=downloads&direction=-1&limit=100&filter=text-generation
 * 多分类(2026-07-22 立):基于 tags + 模型名特征拆 6 类(overall/chat/coding/instruction/reasoning/open-source)
 */
async function fetchHFOpenLLM(): Promise<LeaderboardEntry[]> {
  try {
    const url = 'https://huggingface.co/api/models?sort=downloads&direction=-1&limit=100&full=true&filter=text-generation'
    const res = await fetchWithTimeout(
      url,
      { headers: { 'User-Agent': LEADERBOARD_USER_AGENT, Accept: 'application/json' } },
      30000,
    )
    if (!res.ok) {
      logger.warn(`[ai-world-sync] HF Hub models API HTTP ${res.status}, skip`)
      return []
    }
    const data = (await res.json()) as Array<{
      id: string
      downloads: number
      likes: number
      pipeline_tag?: string
      lastModified?: string
      tags?: string[]
    }>
    const now = new Date()
    const filtered = data.filter((m) => m.id && typeof m.downloads === 'number')
    const baseEntry = (m: typeof filtered[number], rank: number, category: string, score: number) => ({
      leaderboard: 'hf-open-llm' as const,
      category,
      rank,
      modelName: m.id.slice(0, 200),
      provider: m.id.split('/')[0],
      score: String(score),
      scores: {
        downloads: m.downloads,
        likes: m.likes,
        pipeline: m.pipeline_tag,
        source: 'huggingface-hub-models',
      },
      publishedAt: m.lastModified ? new Date(m.lastModified) : now,
    })
    const entries: LeaderboardEntry[] = []
    // overall:全部 top 50(按 downloads 降序)
    const overallTop = filtered.slice(0, 50)
    overallTop.forEach((m, i) => entries.push(baseEntry(m, i + 1, 'overall', m.downloads)))
    // 分类判定 helper
    const hasTag = (m: typeof filtered[number], keys: string[]) => {
      const tags = (m.tags ?? []).map((t) => t.toLowerCase())
      const id = m.id.toLowerCase()
      return keys.some((k) => tags.includes(k) || id.includes(k))
    }
    // chat:tags 含 conversational/chat
    const chatTop = filtered.filter((m) => hasTag(m, ['conversational', 'chat', 'rlhf', 'dpo'])).slice(0, 30)
    chatTop.forEach((m, i) => entries.push(baseEntry(m, i + 1, 'chat', m.downloads)))
    // coding:tags 含 code/coder
    const codingTop = filtered.filter((m) => hasTag(m, ['code', 'coder', 'codestral', 'starcoder', 'deepseek-coder'])).slice(0, 30)
    codingTop.forEach((m, i) => entries.push(baseEntry(m, i + 1, 'coding', m.downloads)))
    // instruction:tags 含 instruct
    const instTop = filtered.filter((m) => hasTag(m, ['instruct', 'instruction', 'it'])).slice(0, 30)
    instTop.forEach((m, i) => entries.push(baseEntry(m, i + 1, 'instruction', m.downloads)))
    // reasoning:tags 含 reasoning 或模型名含 r1/o1
    const reasonTop = filtered.filter((m) => hasTag(m, ['reasoning', 'reason', 'r1', 'o1', 'qwq'])).slice(0, 30)
    reasonTop.forEach((m, i) => entries.push(baseEntry(m, i + 1, 'reasoning', m.downloads)))
    // open-source:license 在 OSI 列表(简化判定:tags 含 'license:' 开源协议)
    const OSI_LICENSES = ['mit', 'apache-2.0', 'apache 2.0', 'gpl', 'lgpl', 'bsd', 'mpl', 'unlicense', 'cc-by-sa-4.0', 'cc0']
    const openTop = filtered.filter((m) => {
      const tags = (m.tags ?? []).map((t) => t.toLowerCase())
      return tags.some((t) => t.startsWith('license:') && OSI_LICENSES.some((lic) => t.includes(lic)))
    }).slice(0, 30)
    openTop.forEach((m, i) => entries.push(baseEntry(m, i + 1, 'open-source', m.downloads)))
    const catCount: Record<string, number> = {}
    for (const e of entries) catCount[e.category] = (catCount[e.category] ?? 0) + 1
    logger.info(`[ai-world-sync] HF Hub models fetched ${entries.length} entries across ${Object.keys(catCount).length} categories: ${JSON.stringify(catCount)}`)
    return entries
  } catch (err) {
    logger.warn('[ai-world-sync] HF Hub models API error:', { error: err instanceof Error ? err.message : err })
    return []
  }
}

/**
 * 抓 SuperCLUE(中文综合榜)
 * 数据源:https://www.superclueai.com/leaderboard — Gradio 3.39.0 SSG 应用
 * 数据嵌入在 window.gradio_config = {...} 内联 script 中(700KB JSON)
 * 结构:config.components[].props.value = { headers: [...], data: [[row1], [row2], ...] }
 * 第一个 dataframe(id=13)是总排行榜,13 列:排名/模型名称/机构/开源闭源/总分/数学推理/科学推理/代码生成/智能体Agent/精确指令遵循/幻觉控制/使用方式/发布日期
 * 多分类(2026-07-22 立):基于子分数列拆 6 类(overall/reasoning/coding/agent/instruction/safety)
 */
const SUPERCLUE_SUBSCORE_MAP: Record<string, string> = {
  '数学推理': 'reasoning', '科学推理': 'reasoning',
  '代码生成': 'coding',
  '智能体Agent': 'agent',
  '精确指令遵循': 'instruction',
  '幻觉控制': 'safety',
}
async function fetchSuperCLUE(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetchWithTimeout(
      'https://www.superclueai.com/leaderboard',
      { headers: { 'User-Agent': LEADERBOARD_USER_AGENT, Accept: 'text/html' } },
      30000,
    )
    if (!res.ok) {
      logger.warn(`[ai-world-sync] SuperCLUE HTTP ${res.status}, skip`)
      return []
    }
    const html = await res.text()
    const configMatch = html.match(/window\.gradio_config\s*=\s*(\{[\s\S]*?\});\s*<\/script>/)
    if (!configMatch || !configMatch[1]) {
      logger.warn('[ai-world-sync] SuperCLUE gradio_config not found in HTML, skip')
      return []
    }
    const config = JSON.parse(configMatch[1]) as {
      components?: Array<{
        id: number
        type: string
        props?: {
          value?: {
            headers?: string[]
            data?: Array<Array<string | number>>
          }
        }
      }>
    }
    const firstDf = config.components?.find((c) => c.type === 'dataframe' && c.props?.value?.data?.length)
    if (!firstDf || !firstDf.props?.value?.data) {
      logger.warn('[ai-world-sync] SuperCLUE no dataframe with data found, skip')
      return []
    }
    const dfValue = firstDf.props.value
    const headers = dfValue.headers ?? []
    const rows = dfValue.data ?? []
    const now = new Date()
    // 提取原始行数据(含 modelName / provider / 总分 / 各子分数)
    const rawRows: Array<{ modelName: string; provider?: string; totalScore: number; subScores: Record<string, number> }> = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length < 5) continue
      const modelName = String(row[1] ?? '').trim()
      if (!modelName || modelName === '-') continue
      const provider = String(row[2] ?? '').trim() || undefined
      const totalScore = row[4]
      const scoreNum = typeof totalScore === 'number' ? totalScore : parseFloat(String(totalScore ?? ''))
      if (!Number.isFinite(scoreNum)) continue
      const subScores: Record<string, number> = {}
      for (let j = 5; j < Math.min(headers.length, row.length); j++) {
        const headerName = headers[j]
        if (!headerName) continue
        const subScore = row[j]
        if (typeof subScore === 'number' && Number.isFinite(subScore)) {
          subScores[headerName] = subScore
        }
      }
      rawRows.push({ modelName, provider, totalScore: scoreNum, subScores })
    }
    // overall:按总分降序 top 50
    const overallSorted = [...rawRows].sort((a, b) => b.totalScore - a.totalScore).slice(0, 50)
    const entries: LeaderboardEntry[] = overallSorted.map((r, i) => ({
      leaderboard: 'superclue',
      category: 'overall',
      rank: i + 1,
      modelName: r.modelName.slice(0, 200),
      provider: r.provider,
      score: r.totalScore.toFixed(2),
      scores: { total: r.totalScore, ...r.subScores, source: 'superclue' },
      publishedAt: now,
    }))
    // 子分类:按 SUPERCLUE_SUBSCORE_MAP 拆分,每个子分类 top 30
    const byCat: Record<string, Array<{ modelName: string; provider?: string; subScore: number; subScores: Record<string, number> }>> = {}
    for (const r of rawRows) {
      for (const [header, subScore] of Object.entries(r.subScores)) {
        const cat = SUPERCLUE_SUBSCORE_MAP[header]
        if (!cat) continue
        if (!byCat[cat]) byCat[cat] = []
        byCat[cat].push({ modelName: r.modelName, provider: r.provider, subScore, subScores: r.subScores })
      }
    }
    for (const [cat, items] of Object.entries(byCat)) {
      items.sort((a, b) => b.subScore - a.subScore)
      const top = items.slice(0, 30)
      for (let i = 0; i < top.length; i++) {
        const it = top[i]!
        entries.push({
          leaderboard: 'superclue',
          category: cat,
          rank: i + 1,
          modelName: it.modelName.slice(0, 200),
          provider: it.provider,
          score: it.subScore.toFixed(2),
          scores: { ...it.subScores, source: 'superclue' },
          publishedAt: now,
        })
      }
    }
    const catCount: Record<string, number> = {}
    for (const e of entries) catCount[e.category] = (catCount[e.category] ?? 0) + 1
    logger.info(`[ai-world-sync] SuperCLUE fetched ${entries.length} entries across ${Object.keys(catCount).length} categories: ${JSON.stringify(catCount)}`)
    return entries
  } catch (err) {
    logger.warn('[ai-world-sync] SuperCLUE leaderboard error:', { error: err instanceof Error ? err.message : err })
    return []
  }
}

/**
 * 抓 Artificial Analysis(综合性能榜)
 * 数据源:https://artificialanalysis.ai/models — Next.js RSC 应用,1.3MB HTML
 * 数据嵌入在 self.__next_f.push([1,"..."]) 格式的 RSC chunks 中
 * 多分类(2026-07-22 立):基于 briefcaseBreakdown + 顶层分数 + 评测通过率拆 9 类
 *   - 3 elo 子分类:overall/analytical/presentation(来自 briefcaseBreakdown)
 *   - 3 index 子分类:intelligence/coding/agentic(来自顶层 intelligenceIndex/codingIndex/agenticIndex)
 *   - 3 rate 子分类:knowledge/reasoning/instruction(来自 gpqa/hle/ifbench 通过率,0-1 转 0-100)
 */
async function fetchArtificialAnalysis(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetchWithTimeout(
      'https://artificialanalysis.ai/models',
      { headers: { 'User-Agent': LEADERBOARD_USER_AGENT, Accept: 'text/html' } },
      30000,
    )
    if (!res.ok) {
      logger.warn(`[ai-world-sync] Artificial Analysis HTTP ${res.status}, skip`)
      return []
    }
    const html = await res.text()
    const now = new Date()

    // 提取 RSC chunks 并合并
    const rscChunks = html.match(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g) || []
    let combinedData = ''
    for (const chunk of rscChunks) {
      const content = chunk.match(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/)?.[1] || ''
      try {
        const unescaped = content.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
        combinedData += unescaped
      } catch {
        combinedData += content
      }
    }

    // 9 分类数据收集:每类按分数排序后填 rank
    const byCat: Record<string, Array<{ modelName: string; provider?: string; score: number; scores: Record<string, unknown> }>> = {}
    const uiWords = new Set(['Intelligence', 'Speed', 'Quality', 'Cost', 'Artificial Analysis', 'next-size-adjust', 'Cost per Task'])
    const seenModel = new Set<string>()

    const addEntry = (cat: string, modelName: string, score: number, scores: Record<string, unknown>) => {
      if (!modelName || uiWords.has(modelName) || score <= 0) return
      if (!byCat[cat]) byCat[cat] = []
      byCat[cat].push({
        modelName,
        provider: modelName.split(/[\s-]/)[0] ?? modelName,
        score,
        scores,
      })
    }

    // 平衡括号扫描每个 briefcaseBreakdown 块
    const bbRegex = /"briefcaseBreakdown":\{/g
    let bbMatch: RegExpExecArray | null
    while ((bbMatch = bbRegex.exec(combinedData)) !== null) {
      const bbStart = bbMatch.index + '"briefcaseBreakdown":'.length
      let depth = 0
      let end = -1
      for (let i = bbStart; i < combinedData.length; i++) {
        const c = combinedData[i]
        if (c === '{') depth++
        else if (c === '}') {
          depth--
          if (depth === 0) { end = i + 1; break }
        }
      }
      if (end < 0) continue
      const bbContent = combinedData.slice(bbStart, end)

      // 提取 3 个 elo 子分类
      const overallElo = bbContent.match(/"overall":\{"elo":(\d+(?:\.\d+)?)/)?.[1]
      const analyticalElo = bbContent.match(/"analyticalQuality":\{"elo":(\d+(?:\.\d+)?)/)?.[1]
      const presentationElo = bbContent.match(/"presentation":\{"elo":(\d+(?:\.\d+)?)/)?.[1]

      // evaluations 边界定位(过滤 evaluation slug 污染,找模型真正的 slug/name)
      const windowStart = Math.max(0, bbMatch.index - 15000)
      const window = combinedData.slice(windowStart, bbMatch.index)
      const evalIdx = window.lastIndexOf('"evaluations":[')
      const cutoff = evalIdx >= 0 ? evalIdx : window.length
      const beforeEvals = window.slice(0, cutoff)
      const slugMatches = [...beforeEvals.matchAll(/"slug":"([^"]{2,100})"/g)]
      const nameMatches = [...beforeEvals.matchAll(/"name":"([^"]{2,100})"/g)]
      const lastSlug = slugMatches[slugMatches.length - 1]?.[1]
      const lastName = nameMatches[nameMatches.length - 1]?.[1]
      const modelName = (lastName ?? lastSlug ?? '').trim()
      if (!modelName || seenModel.has(modelName)) continue
      seenModel.add(modelName)

      // 从 BB 往前 5000 字符找顶层分数(intelligenceIndex/codingIndex/agenticIndex/gpqa/hle/ifbench)
      const scoreWindow = combinedData.slice(Math.max(0, bbMatch.index - 5000), bbMatch.index)
      const intelM = scoreWindow.match(/"intelligenceIndex":(\d+(?:\.\d+)?)/)
      const codingM = scoreWindow.match(/"codingIndex":(\d+(?:\.\d+)?)/)
      const agenticM = scoreWindow.match(/"agenticIndex":(\d+(?:\.\d+)?)/)
      const gpqaM = scoreWindow.match(/"gpqa":(\d+(?:\.\d+)?)/)
      const hleM = scoreWindow.match(/"hle":(\d+(?:\.\d+)?)/)
      const ifbenchM = scoreWindow.match(/"ifbench":(\d+(?:\.\d+)?)/)

      // 添加 elo 子分类
      if (overallElo) {
        const elo = parseFloat(overallElo)
        if (Number.isFinite(elo) && elo > 0) addEntry('overall', modelName, elo, { elo, source: 'briefcase-overall' })
      }
      if (analyticalElo) {
        const elo = parseFloat(analyticalElo)
        if (Number.isFinite(elo) && elo > 0) addEntry('analytical', modelName, elo, { elo, source: 'briefcase-analytical' })
      }
      if (presentationElo) {
        const elo = parseFloat(presentationElo)
        if (Number.isFinite(elo) && elo > 0) addEntry('presentation', modelName, elo, { elo, source: 'briefcase-presentation' })
      }
      // 添加 index 子分类(0-100 分)
      if (intelM && intelM[1]) {
        const v = parseFloat(intelM[1])
        if (Number.isFinite(v) && v > 0) addEntry('intelligence', modelName, v, { intelligenceIndex: v, source: 'intelligence-index' })
      }
      if (codingM && codingM[1]) {
        const v = parseFloat(codingM[1])
        if (Number.isFinite(v) && v > 0) addEntry('coding', modelName, v, { codingIndex: v, source: 'coding-index' })
      }
      if (agenticM && agenticM[1]) {
        const v = parseFloat(agenticM[1])
        if (Number.isFinite(v) && v > 0) addEntry('agentic', modelName, v, { agenticIndex: v, source: 'agentic-index' })
      }
      // 添加 rate 子分类(0-1 通过率转 0-100 分)
      if (gpqaM && gpqaM[1]) {
        const v = parseFloat(gpqaM[1])
        if (Number.isFinite(v) && v > 0) {
          const score = v <= 1 ? v * 100 : v
          addEntry('knowledge', modelName, score, { gpqa: v, source: 'gpqa-diamond' })
        }
      }
      if (hleM && hleM[1]) {
        const v = parseFloat(hleM[1])
        if (Number.isFinite(v) && v > 0) {
          const score = v <= 1 ? v * 100 : v
          addEntry('reasoning', modelName, score, { hle: v, source: 'humanitys-last-exam' })
        }
      }
      if (ifbenchM && ifbenchM[1]) {
        const v = parseFloat(ifbenchM[1])
        if (Number.isFinite(v) && v > 0) {
          const score = v <= 1 ? v * 100 : v
          addEntry('instruction', modelName, score, { ifbench: v, source: 'ifbench' })
        }
      }
    }

    // 每类按分数降序排序,top 30,填 rank
    const entries: LeaderboardEntry[] = []
    for (const [cat, items] of Object.entries(byCat)) {
      items.sort((a, b) => b.score - a.score)
      const top = items.slice(0, 30)
      for (let i = 0; i < top.length; i++) {
        const it = top[i]!
        entries.push({
          leaderboard: 'artificial-analysis',
          category: cat,
          rank: i + 1,
          modelName: it.modelName.slice(0, 200),
          provider: it.provider,
          score: it.score.toFixed(2),
          scores: it.scores,
          publishedAt: now,
        })
      }
    }
    const catCount: Record<string, number> = {}
    for (const e of entries) catCount[e.category] = (catCount[e.category] ?? 0) + 1
    logger.info(`[ai-world-sync] Artificial Analysis fetched ${entries.length} entries across ${Object.keys(catCount).length} categories: ${JSON.stringify(catCount)}`)
    return entries
  } catch (err) {
    logger.warn('[ai-world-sync] Artificial Analysis error:', { error: err instanceof Error ? err.message : err })
    return []
  }
}

/** 排行榜抓取器注册表(dry-run + syncRankings 共用) */
const RANKING_FETCHERS: Array<{ source: string; fn: () => Promise<LeaderboardEntry[]> }> = [
  { source: 'lmsys', fn: fetchLMSYSArena },
  { source: 'opencompass', fn: fetchOpenCompass },
  { source: 'hf-open-llm', fn: fetchHFOpenLLM },
  { source: 'superclue', fn: fetchSuperCLUE },
  { source: 'artificial-analysis', fn: fetchArtificialAnalysis },
]

/** upsert 单个排行榜条目(leaderboard+category+modelName 唯一) */
async function upsertRanking(entry: LeaderboardEntry): Promise<'inserted' | 'updated' | 'error'> {
  try {
    const existing = await db
      .select({ id: aiWorldRankings.id })
      .from(aiWorldRankings)
      .where(and(
        eq(aiWorldRankings.leaderboard, entry.leaderboard),
        eq(aiWorldRankings.category, entry.category),
        eq(aiWorldRankings.modelName, entry.modelName),
      ))
      .limit(1)
    const now = new Date()
    if (existing.length > 0) {
      await db
        .update(aiWorldRankings)
        .set({
          rank: entry.rank,
          provider: entry.provider,
          score: entry.score,
          scores: entry.scores,
          publishedAt: entry.publishedAt,
          fetchedAt: now,
          updatedAt: now,
        })
        .where(eq(aiWorldRankings.id, existing[0]!.id))
      return 'updated'
    }
    const payload: NewAiWorldRanking = {
      leaderboard: entry.leaderboard,
      category: entry.category,
      rank: entry.rank,
      modelName: entry.modelName.slice(0, 200),
      provider: entry.provider,
      score: entry.score,
      scores: entry.scores,
      metadata: {},
      publishedAt: entry.publishedAt,
      fetchedAt: now,
    }
    await db.insert(aiWorldRankings).values(payload).onConflictDoNothing()
    return 'inserted'
  } catch (err) {
    logger.warn(
      `[ai-world-sync] upsertRanking ${entry.leaderboard}/${entry.modelName} error:`,
      { error: err instanceof Error ? err.message : err },
    )
    return 'error'
  }
}

/** 同步所有模型排行榜(5 大权威榜单),返回 SyncSourceResult[],写 aiWorldSyncLog(kind='ranking') */
export async function syncRankings(): Promise<SyncSourceResult[]> {
  const results: SyncSourceResult[] = []
  for (const { source, fn } of RANKING_FETCHERS) {
    const startedAt = new Date()
    try {
      const entries = await fn()
      let successCount = 0
      for (const entry of entries) {
        const r = await upsertRanking(entry)
        if (r === 'inserted' || r === 'updated') successCount++
      }
      // 空数据视为 success(页面 JS 渲染拿不到表格,不算失败,只记录提示)
      const status: SyncSourceResult['status'] = entries.length === 0 || successCount > 0 ? 'success' : 'failed'
      const result: SyncSourceResult = {
        source,
        kind: 'ranking',
        status,
        itemCount: successCount,
        startedAt,
        finishedAt: new Date(),
        error: entries.length === 0 ? 'no table rows (page may be JS-rendered)' : undefined,
      }
      await writeSyncLog(result)
      results.push(result)
    } catch (err) {
      const result: SyncSourceResult = {
        source,
        kind: 'ranking',
        status: 'failed',
        itemCount: 0,
        startedAt,
        finishedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      }
      await writeSyncLog(result)
      results.push(result)
    }
  }
  return results
}

// ===== GitHub 仓库热度指标抓取(2026-07-22 新增) =====

/** 抓单个 GitHub 仓库的 stars/forks/watchers/subscribers/openIssues,失败返回 null
 * 支持 GITHUB_TOKEN 环境变量(限额从 60/h 提升到 5000/h)
 */
async function fetchGithubRepoMetrics(owner: string, repo: string): Promise<{
  stars: number
  forks: number
  watchers: number
  subscribers: number
  openIssues: number
} | null> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'IHUI-AI/1.0 AI-World-Sync',
    }
    // 如果配置了 GITHUB_TOKEN,加 Authorization header(限额从 60/h → 5000/h)
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
    }
    const res = await fetchWithTimeout(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers },
      15000,
    )
    if (!res.ok) {
      // 403 + X-RateLimit-Remaining: 0 → rate limit
      if (res.status === 403) {
        const remaining = res.headers.get('X-RateLimit-Remaining')
        if (remaining === '0') {
          logger.warn(`[ai-world-sync] GitHub API rate limit exceeded (配置 GITHUB_TOKEN 环境变量可提升到 5000/h)`)
        } else {
          logger.warn(`[ai-world-sync] github repo ${owner}/${repo} HTTP 403, skip`)
        }
      } else {
        logger.warn(`[ai-world-sync] github repo ${owner}/${repo} HTTP ${res.status}, skip`)
      }
      return null
    }
    const data = (await res.json()) as {
      stargazers_count?: number
      forks_count?: number
      watchers_count?: number
      subscribers_count?: number
      open_issues_count?: number
    }
    return {
      stars: data.stargazers_count ?? 0,
      forks: data.forks_count ?? 0,
      watchers: data.watchers_count ?? 0,
      subscribers: data.subscribers_count ?? 0,
      openIssues: data.open_issues_count ?? 0,
    }
  } catch (err) {
    logger.warn(`[ai-world-sync] github repo ${owner}/${repo} error:`, { error: err instanceof Error ? err.message : err })
    return null
  }
}

/** 纯计算降级热度分(stars + forks → 0-100),LLM 不可用时用 */
function computeTrendingScoreFallback(stars: number, forks: number): number {
  const score = Math.log10(stars + 1) * 10 + Math.log10(forks + 1) * 5
  return Math.min(100, Math.max(0, Math.round(score)))
}

/**
 * 同步所有 AI 仓库的热度数据(GitHub stars/forks + LLM 综合分 0-100)
 * 流程:遍历 AI_REPOS_GITHUB → fetchGithubRepoMetrics → 更新 aiWorldItems 的
 * trendingScore/trendingMetrics/trendingUpdatedAt → 写 aiWorldSyncLog(kind='trending')
 * 小批量并行(每批 5 个)避免 GitHub rate limit
 */
export async function syncTrendingMetrics(): Promise<SyncSourceResult[]> {
  const results: SyncSourceResult[] = []
  const BATCH_SIZE = 5
  for (let i = 0; i < AI_REPOS_GITHUB.length; i += BATCH_SIZE) {
    const batch = AI_REPOS_GITHUB.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(async (repoInfo) => {
        const startedAt = new Date()
        const metrics = await fetchGithubRepoMetrics(repoInfo.owner, repoInfo.repo)
        if (!metrics) {
          const result: SyncSourceResult = {
            source: repoInfo.source,
            kind: 'trending',
            status: 'failed',
            itemCount: 0,
            startedAt,
            finishedAt: new Date(),
            error: `github ${repoInfo.owner}/${repoInfo.repo} fetch failed`,
          }
          await writeSyncLog(result)
          return result
        }
        try {
          // 通过 source + kind 匹配 aiWorldItems,拿 viewCount 用于 LLM 综合分
          const existing = await db
            .select({ id: aiWorldItems.id, viewCount: aiWorldItems.viewCount })
            .from(aiWorldItems)
            .where(and(eq(aiWorldItems.source, repoInfo.source), eq(aiWorldItems.kind, repoInfo.kind)))
            .limit(1)
          if (existing.length === 0) {
            const result: SyncSourceResult = {
              source: repoInfo.source,
              kind: 'trending',
              status: 'success',
              itemCount: 0,
              startedAt,
              finishedAt: new Date(),
              error: 'no matching aiWorldItems row (item not synced yet)',
            }
            await writeSyncLog(result)
            return result
          }
          const itemId = existing[0]!.id
          const viewCount = existing[0]!.viewCount ?? 0

          // LLM 综合分(失败降级用纯计算公式)
          const llmScore = await callLlm(
            '根据以下数据综合给出该 AI 工具的热度分(0-100 整数,只返回数字):',
            `stars=${metrics.stars}, forks=${metrics.forks}, viewCount=${viewCount}`,
            10000,
          )
          let trendingScore: number
          if (llmScore) {
            const parsed = parseInt(llmScore.replace(/\D/g, ''), 10)
            trendingScore = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
              ? parsed
              : computeTrendingScoreFallback(metrics.stars, metrics.forks)
          } else {
            trendingScore = computeTrendingScoreFallback(metrics.stars, metrics.forks)
          }

          const now = new Date()
          await db
            .update(aiWorldItems)
            .set({
              trendingScore,
              trendingMetrics: {
                githubStars: metrics.stars,
                githubForks: metrics.forks,
                githubWatchers: metrics.watchers,
                githubSubscribers: metrics.subscribers,
                githubOpenIssues: metrics.openIssues,
              },
              trendingUpdatedAt: now,
              updatedAt: now,
            })
            .where(eq(aiWorldItems.id, itemId))

          const result: SyncSourceResult = {
            source: repoInfo.source,
            kind: 'trending',
            status: 'success',
            itemCount: 1,
            startedAt,
            finishedAt: new Date(),
          }
          await writeSyncLog(result)
          return result
        } catch (err) {
          const result: SyncSourceResult = {
            source: repoInfo.source,
            kind: 'trending',
            status: 'failed',
            itemCount: 0,
            startedAt,
            finishedAt: new Date(),
            error: err instanceof Error ? err.message : String(err),
          }
          await writeSyncLog(result)
          return result
        }
      }),
    )
    results.push(...batchResults)
  }
  return results
}

// ===== 独立调度器(排行 + 热度,2026-07-22 新增) =====

let rankingScheduledTask: ScheduledTask | null = null
let trendingScheduledTask: ScheduledTask | null = null

/** 启动模型排行榜定时任务(每日 6 点,模型榜单更新慢) */
export function startRankingScheduler(): void {
  if (rankingScheduledTask) return
  rankingScheduledTask = cron.schedule('0 6 * * *', async () => {
    try {
      const results = await syncRankings()
      const ok = results.filter((r) => r.status === 'success').length
      const fail = results.filter((r) => r.status === 'failed').length
      const items = results.reduce((sum, r) => sum + r.itemCount, 0)
      logger.info(`[ai-world-sync] ranking done: ${ok} success, ${fail} failed, ${items} items`)
    } catch (err) {
      logger.error('[ai-world-sync] ranking fatal:', { error: err })
    }
  }, {
    timezone: 'Asia/Shanghai',
  })
  logger.info('[ai-world-sync] ranking scheduler started (cron: 0 6 * * * Asia/Shanghai)')
}

/** 停止模型排行榜定时任务 */
export function stopRankingScheduler(): void {
  if (rankingScheduledTask) {
    rankingScheduledTask.stop()
    rankingScheduledTask = null
  }
}

/** 启动热度更新定时任务(每 4 小时) */
export function startTrendingScheduler(): void {
  if (trendingScheduledTask) return
  trendingScheduledTask = cron.schedule('0 */4 * * *', async () => {
    try {
      const results = await syncTrendingMetrics()
      const ok = results.filter((r) => r.status === 'success').length
      const fail = results.filter((r) => r.status === 'failed').length
      const items = results.reduce((sum, r) => sum + r.itemCount, 0)
      logger.info(`[ai-world-sync] trending done: ${ok} success, ${fail} failed, ${items} items`)
    } catch (err) {
      logger.error('[ai-world-sync] trending fatal:', { error: err })
    }
  }, {
    timezone: 'Asia/Shanghai',
  })
  logger.info('[ai-world-sync] trending scheduler started (cron: 0 */4 * * * Asia/Shanghai)')
}

/** 停止热度更新定时任务 */
export function stopTrendingScheduler(): void {
  if (trendingScheduledTask) {
    trendingScheduledTask.stop()
    trendingScheduledTask = null
  }
}

// ===== Dry-run 模式(只调 fetcher 不写库,2026-07-22 新增) =====

/**
 * 跑所有 fetcher,只统计预计条目数,不写库(不调 upsertItem / upsertRanking / db.update)
 * 用于上线前验证抓取链路连通性 + 各源数据量预估
 */
export async function runDryRun(): Promise<Array<{ source: string; kind: string; estimatedItems: number; error?: string }>> {
  const results: Array<{ source: string; kind: string; estimatedItems: number; error?: string }> = []

  // RSS(30 源)
  for (const feed of RSS_FEEDS) {
    try {
      const items = await fetchRssFeed(feed)
      results.push({ source: feed.source, kind: 'rss', estimatedItems: items.length })
    } catch (err) {
      results.push({ source: feed.source, kind: 'rss', estimatedItems: 0, error: err instanceof Error ? err.message : String(err) })
    }
  }
  // arXiv
  try {
    const items = await fetchArxivPapers()
    results.push({ source: 'arxiv', kind: 'paper', estimatedItems: items.length })
  } catch (err) {
    results.push({ source: 'arxiv', kind: 'paper', estimatedItems: 0, error: err instanceof Error ? err.message : String(err) })
  }
  // HF Papers
  try {
    const items = await fetchHuggingfacePapers()
    results.push({ source: 'huggingface-papers', kind: 'paper', estimatedItems: items.length })
  } catch (err) {
    results.push({ source: 'huggingface-papers', kind: 'paper', estimatedItems: 0, error: err instanceof Error ? err.message : String(err) })
  }
  // GitHub Trending
  try {
    const items = await fetchGithubTrending()
    results.push({ source: 'github', kind: 'project', estimatedItems: items.length })
  } catch (err) {
    results.push({ source: 'github', kind: 'project', estimatedItems: 0, error: err instanceof Error ? err.message : String(err) })
  }
  // AI Apps(35+)
  for (const entry of AI_APPS) {
    try {
      const item = await fetchSiteMeta(entry, 'app')
      results.push({ source: entry.source, kind: 'app', estimatedItems: item ? 1 : 0 })
    } catch (err) {
      results.push({ source: entry.source, kind: 'app', estimatedItems: 0, error: err instanceof Error ? err.message : String(err) })
    }
  }
  // AI Tools(35+)
  for (const entry of AI_TOOLS) {
    try {
      const item = await fetchSiteMeta(entry, 'tool')
      results.push({ source: entry.source, kind: 'tool', estimatedItems: item ? 1 : 0 })
    } catch (err) {
      results.push({ source: entry.source, kind: 'tool', estimatedItems: 0, error: err instanceof Error ? err.message : String(err) })
    }
  }
  // 5 大排行榜
  for (const { source, fn } of RANKING_FETCHERS) {
    try {
      const entries = await fn()
      results.push({ source, kind: 'ranking', estimatedItems: entries.length })
    } catch (err) {
      results.push({ source, kind: 'ranking', estimatedItems: 0, error: err instanceof Error ? err.message : String(err) })
    }
  }
  // GitHub 仓库热度
  for (const repoInfo of AI_REPOS_GITHUB) {
    try {
      const metrics = await fetchGithubRepoMetrics(repoInfo.owner, repoInfo.repo)
      results.push({ source: repoInfo.source, kind: 'trending', estimatedItems: metrics ? 1 : 0 })
    } catch (err) {
      results.push({ source: repoInfo.source, kind: 'trending', estimatedItems: 0, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return results
}

// ===== CLI 入口(--run-once 手动触发 / --dry-run 预估条目数不写库 / --rankings-only 只测 5 大榜单) =====

// 检测 CLI 调用:tsx apps/api/src/jobs/ai-world-sync.ts --run-once | --dry-run | --rankings-only
const isCli = process.argv[1]?.endsWith('ai-world-sync.ts') || process.argv[1]?.endsWith('ai-world-sync.js')
if (isCli && process.argv.includes('--rankings-only')) {
  ;(async () => {
    try {
      logger.info('[ai-world-sync] rankings-only start (5 leaderboards + GitHub trending, no DB writes)')
      const startTime = Date.now()
      // 5 大排行榜
      for (const { source, fn } of RANKING_FETCHERS) {
        const t0 = Date.now()
        try {
          const entries = await fn()
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
          logger.info(`  ✓ ${source}: ${entries.length} entries (${elapsed}s)`)
          // 打印前 3 条样本
          for (const e of entries.slice(0, 3)) {
            logger.info(`      - rank=${e.rank} ${e.provider ? `[${e.provider}] ` : ''}${e.modelName} score=${e.score ?? '-'} cat=${e.category}`)
          }
        } catch (err) {
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
          logger.info(`  ✗ ${source}: error (${elapsed}s) ${err instanceof Error ? err.message : err}`)
        }
      }
      // GitHub 仓库热度(前 5 个样本)
      logger.info('[ai-world-sync] GitHub repo metrics (first 5):')
      for (const repoInfo of AI_REPOS_GITHUB.slice(0, 5)) {
        const t0 = Date.now()
        try {
          const m = await fetchGithubRepoMetrics(repoInfo.owner, repoInfo.repo)
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
          if (m) {
            logger.info(`  ✓ ${repoInfo.source}: stars=${m.stars} forks=${m.forks} (${elapsed}s)`)
          } else {
            logger.info(`  - ${repoInfo.source}: no metrics (${elapsed}s)`)
          }
        } catch (err) {
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
          logger.info(`  ✗ ${repoInfo.source}: error (${elapsed}s) ${err instanceof Error ? err.message : err}`)
        }
      }
      logger.info(`[ai-world-sync] rankings-only done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
      process.exit(0)
    } catch (err) {
      logger.error('[ai-world-sync] rankings-only fatal:', { error: err })
      process.exit(1)
    }
  })()
} else if (isCli && process.argv.includes('--sync-rankings')) {
  ;(async () => {
    try {
      logger.info('[ai-world-sync] sync-rankings start (DELETE old + fetch + upsert + verify)')
      const startTime = Date.now()
      // 1. 删除旧的 5 大榜单数据
      const delRes = await db.execute(sql`DELETE FROM ai_world_rankings WHERE leaderboard IN ('lmsys','opencompass','hf-open-llm','superclue','artificial-analysis')`)
      const delCount = Array.isArray(delRes) ? delRes.length : 0
      logger.info(`[ai-world-sync] deleted ${delCount} old ranking rows`)
      // 2. 调用 syncRankings 抓取 + upsert 新数据
      const results = await syncRankings()
      for (const r of results) {
        logger.info(`  - ${r.source}: ${r.status} items=${r.itemCount}${r.error ? ` err=${r.error}` : ''}`)
      }
      // 3. 验证:GROUP BY 统计每个榜单的分类分布
      const verifyRows = await db.execute(sql`
        SELECT leaderboard, category, COUNT(*) AS n
        FROM ai_world_rankings
        WHERE leaderboard IN ('lmsys','opencompass','hf-open-llm','superclue','artificial-analysis')
        GROUP BY leaderboard, category
        ORDER BY leaderboard, category
      `)
      const rows = (verifyRows as unknown as Array<{ leaderboard: string; category: string; n: number | string }>) ?? []
      const byLeaderboard: Record<string, Array<{ category: string; n: number }>> = {}
      let totalEntries = 0
      for (const row of rows) {
        const lb = row.leaderboard
        const cat = row.category
        const n = typeof row.n === 'string' ? parseInt(row.n, 10) : row.n
        if (!byLeaderboard[lb]) byLeaderboard[lb] = []
        byLeaderboard[lb].push({ category: cat, n: Number.isFinite(n) ? n : 0 })
        totalEntries += Number.isFinite(n) ? n : 0
      }
      logger.info('[ai-world-sync] verify after sync:')
      for (const lb of Object.keys(byLeaderboard).sort()) {
        const cats = byLeaderboard[lb] ?? []
        const catSummary = cats.map((c) => `${c.category}=${c.n}`).join(', ')
        logger.info(`  ${lb} (${cats.length} cats): ${catSummary}`)
      }
      logger.info(`[ai-world-sync] TOTAL: ${totalEntries} entries across ${Object.keys(byLeaderboard).length} leaderboards`)
      logger.info(`[ai-world-sync] sync-rankings done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
      process.exit(0)
    } catch (err) {
      logger.error('[ai-world-sync] sync-rankings fatal:', { error: err })
      process.exit(1)
    }
  })()
} else if (isCli && process.argv.includes('--dry-run')) {
  ;(async () => {
    try {
      logger.info('[ai-world-sync] dry-run start (no DB writes)')
      const stats = getSourceStats()
      logger.info(`[ai-world-sync] sources: rss=${stats.rss} arxiv=${stats.arxiv} github=${stats.github} apps=${stats.apps} tools=${stats.tools} rankings=${stats.rankings} trending=${stats.trending} total=${stats.total}`)
      const results = await runDryRun()
      const totalEstimated = results.reduce((sum, r) => sum + r.estimatedItems, 0)
      const failed = results.filter((r) => r.error).length
      logger.info(`[ai-world-sync] dry-run done: ${results.length} sources, ${totalEstimated} estimated items, ${failed} errors`)
      for (const r of results) {
        logger.info(`  - ${r.source} (${r.kind}): ${r.estimatedItems} items${r.error ? ` err=${r.error}` : ''}`)
      }
      process.exit(0)
    } catch (err) {
      logger.error('[ai-world-sync] dry-run fatal:', { error: err })
      process.exit(1)
    }
  })()
} else if (isCli && process.argv.includes('--run-once')) {
  ;(async () => {
    try {
      logger.info('[ai-world-sync] run-once start')
      const stats = getSourceStats()
      logger.info(`[ai-world-sync] sources: rss=${stats.rss} arxiv=${stats.arxiv} github=${stats.github} apps=${stats.apps} tools=${stats.tools} rankings=${stats.rankings} trending=${stats.trending} total=${stats.total}`)
      const results = await syncAllSources()
      const ok = results.filter((r) => r.status === 'success').length
      const partial = results.filter((r) => r.status === 'partial').length
      const fail = results.filter((r) => r.status === 'failed').length
      const totalItems = results.reduce((sum, r) => sum + r.itemCount, 0)
      logger.info(`[ai-world-sync] run-once done: ${ok} success, ${partial} partial, ${fail} failed, ${totalItems} items`)
      for (const r of results) {
        logger.info(`  - ${r.source} (${r.kind}): ${r.status} items=${r.itemCount}${r.error ? ` err=${r.error}` : ''}`)
      }
      process.exit(0)
    } catch (err) {
      logger.error('[ai-world-sync] run-once fatal:', { error: err })
      process.exit(1)
    }
  })()
}
