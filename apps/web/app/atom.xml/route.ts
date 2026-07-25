/**
 * Atom 1.0 Feed(2026-07-26 立,补 RSS 之外的 feed 协议)
 * - Atom 格式对 GitHub Pages / Netlify / Cloudflare Pages 兼容性更好
 * - 部分 feed 聚合器优先识别 Atom
 */
import { getAllRoutesForFeed, type FeedItem } from '../rss.xml/feed-source'

// 2026-07-26 修复:Next.js output: 'export' 静态导出模式要求所有 Route Handler
// 必须显式声明 force-static 或 revalidate,否则构建报错
export const dynamic = 'force-static'

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

export async function GET() {
  const items = getAllRoutesForFeed()
  const now = new Date().toISOString()
  const buildDate = now

  const entries = items
    .map(
      (item: FeedItem) => `  <entry>
    <id>${SITE_URL}${item.path}</id>
    <title>${escapeXml(item.title)}</title>
    <link href="${SITE_URL}${item.path}" rel="alternate" type="text/html" />
    <updated>${item.publishedAt}</updated>
    <published>${item.publishedAt}</published>
    <author>
      <name>IHUI AI Team</name>
      <email>contact@ihui.ai</email>
    </author>
    <category term="${escapeXml(item.category)}" />
    <summary>${escapeXml(item.description)}</summary>
    <content type="html"><![CDATA[${item.description}]]></content>
  </entry>`,
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${SITE_URL}/atom.xml</id>
  <title>${escapeXml(SITE_TITLE)}</title>
  <subtitle>${escapeXml(SITE_DESCRIPTION)}</subtitle>
  <link href="${SITE_URL}" rel="alternate" type="text/html" />
  <link href="${SITE_URL}/atom.xml" rel="self" type="application/atom+xml" />
  <link href="${SITE_URL}/websub" rel="hub" />
  <icon>${SITE_URL}/images/logo.png</icon>
  <logo>${SITE_URL}/images/logo.png</logo>
  <updated>${now}</updated>
  <rights>© 2024-2026 ${escapeXml(SITE_TITLE)}</rights>
  <generator>IHUI AI Atom Generator</generator>
${entries}
</feed>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      'X-Build-Date': buildDate,
    },
  })
}
