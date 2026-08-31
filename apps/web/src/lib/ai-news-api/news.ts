// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { safeApi } from './http'
import type { AiNewsArticle, AiLiveChannel } from './types'

const FALLBACK_ARTICLES: AiNewsArticle[] = [
  {
    id: 'mock-gpt-5-6',
    title: 'GPT-5.6 系列正式上线:三档分层定价,Sol 编程能力较为突出',
    summary:
      'OpenAI 发布 GPT-5.6 系列三款模型 Sol/Terra/Luna,Sol 在 Coding Agent Index 取得 80 分,价格仅约 Claude Fable 5 的三分之一。',
    coverImage:
      'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
    authorName: 'AI 前沿观察',
    categoryName: 'AI 模型发布',
    viewCount: 8420,
    publishedAt: '2026-07-09T10:00:00+08:00',
    isPinned: true,
    source: 'mock',
  },
  {
    id: 'mock-claude-sonnet-5',
    title: 'Claude Sonnet 5 发布:智能体能力较强的中端模型,3 美元起入门',
    summary:
      'Anthropic 发布 Claude Sonnet 5,智能体评测表现稳健,部分任务接近 Opus 4.8,入门价仅 3 美元。',
    coverImage:
      'https://cdn.sanity.io/images/4zrzovbb/website/2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg',
    authorName: 'AI 前沿观察',
    categoryName: 'AI 模型发布',
    viewCount: 6210,
    publishedAt: '2026-07-01T10:00:00+08:00',
    isPinned: true,
    source: 'mock',
  },
  {
    id: 'mock-kimi-k3',
    title: 'Kimi K3 重磅发布:2.8 万亿参数,大型开源模型',
    summary:
      '月之暗面在 2026 WAIC 大会发布 Kimi K3,2.8 万亿参数,100 万 token 上下文,原生支持视觉理解。',
    coverImage: 'https://statics.moonshot.cn/kimi-blogs/kimi-k3/game-cases/01-open-world.png',
    authorName: '央视新闻',
    categoryName: 'AI 模型发布',
    viewCount: 12380,
    publishedAt: '2026-07-17T09:30:00+08:00',
    isPinned: true,
    source: 'mock',
  },
  {
    id: 'mock-gemini-3-5-pro',
    title: 'Gemini 3.5 Pro 发布:2M 上下文,前端代码生成能力突出',
    summary:
      '谷歌 DeepMind 放弃 2.5 Pro 基座,基于新预训练架构发布 Gemini 3.5 Pro,主打"质量优先于速度",SVG 与前端页面一次生成。',
    coverImage:
      'https://cdn.sanity.io/images/4zrzovbb/website/2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg',
    authorName: 'AI 前沿观察',
    categoryName: 'AI 模型发布',
    viewCount: 5460,
    publishedAt: '2026-07-17T11:00:00+08:00',
    isPinned: false,
    source: 'mock',
  },
  {
    id: 'mock-deepseek-v4',
    title: 'DeepSeek V4 正式版上线:峰谷定价 + DSpark 加速 85%',
    summary:
      'DeepSeek V4 引入峰谷分时计费(9-12、14-18 高峰 2 倍),联合北大发布 DSpark 推理加速框架。',
    coverImage: 'https://cdn.deepseek.com/images/deepseek-chat-open-graph-image.jpeg',
    authorName: 'DeepSeek 官方',
    categoryName: 'AI 模型发布',
    viewCount: 9120,
    publishedAt: '2026-07-17T14:00:00+08:00',
    isPinned: true,
    source: 'mock',
  },
  {
    id: 'mock-waic-2026',
    title: 'WAIC 2026 在上海开幕:9 位图灵奖诺奖得主参会',
    summary:
      '2026 世界人工智能大会 7 月 17-20 日在上海启幕,理查德·萨顿主旨演讲,凯文·凯利畅谈具身智能。',
    coverImage:
      'https://static.www.tencent.com/uploads/2026/07/06/10c8b5b34b4793c92e448b2656379b6e.png!article.cover',
    authorName: '观察者网',
    categoryName: 'AI 产业动态',
    viewCount: 14720,
    publishedAt: '2026-07-17T08:30:00+08:00',
    isPinned: true,
    source: 'mock',
  },
]

const FALLBACK_LIVE_CHANNELS: AiLiveChannel[] = [
  {
    id: 'mock-live-gpt-5-6',
    title: 'GPT-5.6 Sol 首发深度解读:三档分层如何重塑 AI 编程?',
    intro:
      'OpenAI 于 7 月 9 日发布 GPT-5.6 系列,本场拆解 Sol 在 Coding Agent Index 上 80 分的实测表现。',
    coverImage:
      'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
    lecturerName: 'AI 前沿观察',
    categoryName: 'AI 前沿发布',
    isLive: true,
    viewCount: 4280,
    source: 'mock',
  },
  {
    id: 'mock-live-claude-sonnet-5',
    title: 'Claude Sonnet 5 智能体能力实战:从 0 到 1 搭建 Agent 工作流',
    intro: '本场演示 Sonnet 5 在 BrowseComp、OSWorld-Verified 等智能体评测中的突破。',
    coverImage:
      'https://cdn.sanity.io/images/4zrzovbb/website/2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg',
    lecturerName: '王立铭',
    categoryName: 'AI 工程师实战',
    isLive: true,
    viewCount: 3120,
    source: 'mock',
  },
  {
    id: 'mock-live-kimi-k3',
    title: 'Kimi K3 2.8 万亿参数开源大模型深度拆解',
    intro: '月之暗面 7 月 17 日发布 Kimi K3,本场剖析它在编程、视觉、长程任务上的综合表现。',
    coverImage: 'https://statics.moonshot.cn/kimi-blogs/kimi-k3/game-cases/01-open-world.png',
    lecturerName: 'AI 前沿观察',
    categoryName: 'AI 前沿发布',
    isLive: true,
    viewCount: 5640,
    source: 'mock',
  },
  {
    id: 'mock-live-waic-2026',
    title: 'WAIC 2026 主论坛现场直播:理查德·萨顿强化学习主旨演讲',
    intro: '强化学习之父理查德·萨顿主旨演讲,凯文·凯利、约书亚·本吉奥、姚期智同台。',
    coverImage:
      'https://static.www.tencent.com/uploads/2026/07/06/10c8b5b34b4793c92e448b2656379b6e.png!article.cover',
    lecturerName: 'AI 前沿观察',
    categoryName: 'AI 前沿发布',
    isLive: true,
    viewCount: 8970,
    source: 'mock',
  },
]

interface ApiArticleRaw {
  id: string
  title: string
  summary?: string | null
  coverImage?: string | null
  authorName?: string | null
  categoryId?: string | null
  viewCount?: number
  publishedAt?: string | null
  isPinned?: boolean
}

interface ApiChannelRaw {
  id: string
  title: string
  intro?: string | null
  coverImage?: string | null
  lecturerName?: string | null
  categoryId?: string | null
  isLive: boolean
  viewCount: number
}

export async function fetchAiNewsArticles(limit = 9): Promise<AiNewsArticle[]> {
  const qs = new URLSearchParams({ page: '1', pageSize: String(limit) })
  const data = await safeApi<{ list: ApiArticleRaw[] }>(`/api/news/articles?${qs.toString()}`)
  if (!data?.list || data.list.length === 0) {
    return FALLBACK_ARTICLES.slice(0, limit)
  }
  return data.list.map((a) => ({
    id: a.id,
    title: a.title,
    summary: a.summary ?? '',
    coverImage: a.coverImage ?? '',
    authorName: a.authorName ?? 'AI 资讯',
    categoryName: 'AI 资讯',
    viewCount: a.viewCount ?? 0,
    publishedAt: a.publishedAt ?? new Date().toISOString(),
    isPinned: a.isPinned ?? false,
    source: 'api' as const,
  }))
}

export async function fetchAiLiveChannels(limit = 4): Promise<AiLiveChannel[]> {
  const qs = new URLSearchParams({ page: '1', pageSize: String(limit) })
  const data = await safeApi<{ list: ApiChannelRaw[] }>(`/api/live/channels?${qs.toString()}`)
  if (!data?.list || data.list.length === 0) {
    return FALLBACK_LIVE_CHANNELS.slice(0, limit)
  }
  return data.list.slice(0, limit).map((c) => ({
    id: c.id,
    title: c.title,
    intro: c.intro ?? '',
    coverImage: c.coverImage ?? '',
    lecturerName: c.lecturerName ?? 'AI 讲师',
    categoryName: 'AI 直播',
    isLive: c.isLive,
    viewCount: c.viewCount,
    source: 'api' as const,
  }))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
