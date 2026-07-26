/**
 * JSON Feed 1.1(2026-07-26 立,补 RSS/Atom 之外的 JSON 协议):
 * 遵循 [JSON Feed 1.1 规范](https://www.jsonfeed.org/version/1.1/)。
 *
 * 与 RSS/Atom 区别:JSON Feed 把每条 item 当作结构化对象,
 * 适合直接由 LLM / MCP 客户端解析,内容比 RSS 全文更紧凑,比 Atom 更易读。
 *
 * 多语言路径段:/feed.json/zh-CN.json / /feed.json/en.json / /feed.json/zh-TW.json / /feed.json/ja.json / /feed.json/ko.json
 * 根路径 /feed.json → 默认 zh-CN(与其他 feed 协议一致,方便订阅器默认抓取)
 *
 * 2026-07-26 修复:Next.js output:'export' 静态导出模式禁止 Route Handler 使用 searchParams
 * (会触发 `dynamic = "error"` 报错),改用 [lang] 动态段 + generateStaticParams 预生成 5 语言版本。
 *
 * 缓存:1 小时
 */
import { getAllRoutesForFeed } from '../rss.xml/feed-source'

// 2026-07-26:Next.js output:'export' 静态导出模式要求所有 Route Handler
// 必须显式声明 force-static,否则构建报错。
export const dynamic = 'force-static'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ihui.ai'

export const SUPPORTED_LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
export type Lang = (typeof SUPPORTED_LANGS)[number]

const LANGUAGE_MAP: Record<Lang, string> = {
  'zh-CN': 'zh-cn',
  'zh-TW': 'zh-tw',
  en: 'en-us',
  ja: 'ja-jp',
  ko: 'ko-kr',
}

// 5 语言站点元数据(JSON Feed 1.1 字段)
const FEED_META: Record<
  Lang,
  { title: string; description: string; home_page_url: string; author: string }
> = {
  'zh-CN': {
    title: '智汇 AI — 全栈 AI 操作系统',
    description:
      '智汇 AI(IHUI AI)是一站式全栈 AI 操作系统:Agent 市场、知识库 RAG、多模型统一调度、MCP 工具协议,8 端同源,Apache 2.0 开源。',
    home_page_url: `${SITE_URL}/zh-cn`,
    author: 'IHUI AI Team',
  },
  'zh-TW': {
    title: '智匯 AI — 全端 AI 作業系統',
    description:
      '智匯 AI(IHUI AI)是一站式全端 AI 作業系統:Agent 市場、知識庫 RAG、多模型統一調度、MCP 工具協議,8 端同源,Apache 2.0 開源。',
    home_page_url: `${SITE_URL}/zh-tw`,
    author: 'IHUI AI Team',
  },
  en: {
    title: 'IHUI AI — Full-Stack AI Operating System',
    description:
      'IHUI AI is a full-stack AI operating system: Agent marketplace, knowledge base RAG, multi-model orchestration, MCP tool protocol, 8-end sync, Apache 2.0 open source.',
    home_page_url: `${SITE_URL}/en`,
    author: 'IHUI AI Team',
  },
  ja: {
    title: 'IHUI AI — フルスタック AI オペレーティングシステム',
    description:
      'IHUI AI はフルスタックの AI オペレーティングシステム。Agent マーケット、ナレッジベース RAG、マルチモデル統合スケジューリング、MCP ツールプロトコル、8 エンド同期、Apache 2.0 オープンソース。',
    home_page_url: `${SITE_URL}/ja`,
    author: 'IHUI AI Team',
  },
  ko: {
    title: 'IHUI AI — 풀스택 AI 운영체제',
    description:
      'IHUI AI는 풀스택 AI 운영체제입니다. Agent 마켓플레이스, 지식베이스 RAG, 멀티모델 통합 스케줄링, MCP 도구 프로토콜, 8단 동종, Apache 2.0 오픈소스.',
    home_page_url: `${SITE_URL}/ko`,
    author: 'IHUI AI Team',
  },
}

/** 构建指定语言 JSON Feed 1.1 数据 */
export function buildFeedForLang(lang: Lang) {
  const meta = FEED_META[lang]
  const items = getAllRoutesForFeed()

  const feedItems = items.map((item) => {
    const url = `${SITE_URL}${item.path}`
    return {
      id: url,
      url,
      title: item.title,
      summary: item.description,
      content_text: item.description,
      content_html: `<p>${item.description
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</p>`,
      date_published: new Date(item.publishedAt).toISOString(),
      date_modified: new Date(item.publishedAt).toISOString(),
      authors: [{ name: meta.author, url: `${SITE_URL}/about` }],
      tags: [item.category, 'IHUI AI', 'AI', 'Agent', 'RAG'],
      language: lang,
      _ihui: {
        path: item.path,
        category: item.category,
        site: 'ihui.ai',
      },
    }
  })

  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: meta.title,
    home_page_url: meta.home_page_url,
    feed_url: `${SITE_URL}/feed.json/${lang}.json`,
    description: meta.description,
    language: LANGUAGE_MAP[lang],
    favicon: `${SITE_URL}/icon.svg`,
    authors: [{ name: meta.author, url: `${SITE_URL}/about` }],
    hubs: [
      {
        type: 'WebSub',
        url: `${SITE_URL}/websub`,
      },
    ],
    _links: {
      rss: `${SITE_URL}/rss.xml`,
      atom: `${SITE_URL}/atom.xml`,
      websub: `${SITE_URL}/websub`,
      opml: `${SITE_URL}/opml`,
      sitemap: `${SITE_URL}/sitemap.xml`,
      imageSitemap: `${SITE_URL}/image-sitemap.xml`,
      newsSitemap: `${SITE_URL}/news-sitemap.xml`,
    },
    _i18n: {
      current: lang,
      supported: SUPPORTED_LANGS,
      switch: Object.fromEntries(
        SUPPORTED_LANGS.map((l) => [l, `${SITE_URL}/rss.xml?lang=${l}`]),
      ),
    },
    items: feedItems,
  }
}

/** 根路径 /feed.json → 默认 zh-CN 静态输出(与其他 feed 协议保持一致) */
export function GET() {
  const feed = buildFeedForLang('zh-CN')
  return new Response(JSON.stringify(feed, null, 2), {
    headers: {
      'Content-Type': 'application/feed+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      'X-Build-Date': new Date().toISOString(),
      'X-Feed-Lang': 'zh-CN',
    },
  })
}
