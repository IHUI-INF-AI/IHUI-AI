/**
 * RSS 2.0 Feed(2026-07-26 立,极致 SEO):
 * - 覆盖 16+ 高价值页面,提升内容分发和搜索引擎抓取频率
 * - 帮助 Google News / Bing News 收录
 * - 与 sitemap.xml 互补:RSS 强调"最近更新"信号
 *
 * 路由:/rss.xml(Next.js Route Handler)
 * 缓存:1 小时,平衡新鲜度和服务器负载
 */
import { getAllRoutesForFeed } from './feed-source'

const SITE_URL = 'https://ihui.ai'
const SITE_TITLE = 'IHUI AI — 全栈 AI 操作系统'
const SITE_DESCRIPTION =
  '智汇 AI(IHUI AI)是一站式全栈 AI 操作系统,集成 Agent 市场、知识库 RAG、多模型统一调度、MCP 工具协议,支持 Web / 桌面 / 小程序 / 浏览器插件 / React Native / CLI 六端同源,Apache 2.0 开源。'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toRfc2822(iso: string): string {
  return new Date(iso).toUTCString()
}

export async function GET() {
  const items = getAllRoutesForFeed()
  const now = toRfc2822(new Date().toISOString())
  const buildDate = new Date().toISOString()

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>zh-cn</language>
    <copyright>© 2024-2026 ${escapeXml(SITE_TITLE)}</copyright>
    <managingEditor>contact@ihui.ai (IHUI AI Team)</managingEditor>
    <webMaster>contact@ihui.ai (IHUI AI Team)</webMaster>
    <lastBuildDate>${now}</lastBuildDate>
    <pubDate>${now}</pubDate>
    <generator>IHUI AI RSS Generator</generator>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <ttl>60</ttl>
    <image>
      <url>${SITE_URL}/images/logo.png</url>
      <title>${escapeXml(SITE_TITLE)}</title>
      <link>${SITE_URL}</link>
      <width>512</width>
      <height>512</height>
    </image>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items
  .map(
    (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${SITE_URL}${item.path}</link>
      <guid isPermaLink="true">${SITE_URL}${item.path}</guid>
      <dc:creator>IHUI AI Team</dc:creator>
      <pubDate>${toRfc2822(item.publishedAt)}</pubDate>
      <category>${escapeXml(item.category)}</category>
      <description>${escapeXml(item.description)}</description>
      <content:encoded><![CDATA[${item.description}]]></content:encoded>
    </item>`,
  )
  .join('\n')}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      'X-Build-Date': buildDate,
    },
  })
}
