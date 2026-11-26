// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  findArticleById,
  findPublishedArticles,
  type ArticleWithCategory,
} from '../db/news-queries.js'
import { success, error } from '../utils/response.js'
import { withPublicEdgeCache } from '../utils/public-edge-cache.js'

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const RSS_SITE_URL = 'https://www.aizhs.top'
const RSS_TITLE = 'IHUI AI — 智汇AI 每日 AI 资讯'
const RSS_DESCRIPTION =
  '智汇AI（IHUI AI）每日 AI 科技资讯：模型、工具、智能体与行业动态，面向 AI 学习者与从业者。'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toBeijingRfc2822(value: Date | string | null | undefined): string {
  const date = value ? new Date(value) : new Date()
  const safe = Number.isNaN(date.getTime()) ? new Date() : date
  const bj = new Date(safe.getTime() + 8 * 60 * 60 * 1000)
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${weekdays[bj.getUTCDay()]}, ${pad(bj.getUTCDate())} ${months[bj.getUTCMonth()]} ${bj.getUTCFullYear()} ${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}:${pad(bj.getUTCSeconds())} +0800`
}

/** 把站点文章的 Markdown 正文转成企鹅号 RSS 规范要求的 HTML 正文。 */
function markdownToHtml(markdown: string): string {
  const inline = (value: string) =>
    escapeXml(value)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')

  const html: string[] = []
  let inList = false
  const closeList = () => {
    if (inList) {
      html.push('</ul>')
      inList = false
    }
  }

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) {
      closeList()
      continue
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      closeList()
      const level = (heading[1] ?? '##').length
      html.push(`<h${level}>${inline(heading[2] ?? '')}</h${level}>`)
      continue
    }
    const listItem = line.match(/^[-*]\s+(.*)$/)
    if (listItem) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${inline(listItem[1] ?? '')}</li>`)
      continue
    }
    closeList()
    html.push(`<p>${inline(line)}</p>`)
  }
  closeList()
  return html.join('\n')
}

/**
 * RN 端契约补齐:packages/types 的 ArticleListItem/ArticleDetailItem 用
 * author/cover/views/publishedAt(详情另有 content/likes),而 news_articles 表列名是
 * authorName/coverImage/viewCount。此前 /api/articles 直接返回表原形,RN 屏照契约读字段
 * ⇒ 标题在、作者/浏览量/封面全空。这里**在原字段之上增补契约键**(不删原键:Web/admin/测试
 * 仍按 categoryName 等表原形断言)。news_articles 无点赞列 ⇒ likes 恒 0,
 * RN 详情页的点赞本就是本地态(apps/mobile-rn/src/screens/ArticleDetailScreen.tsx:99)。
 */
function withAppContract(a: ArticleWithCategory) {
  return {
    ...a,
    author: a.authorName ?? '',
    cover: a.coverImage ?? undefined,
    views: a.viewCount ?? 0,
    likes: 0,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : '',
  }
}

const articlesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z
    .unknown()
    .transform((v) => (v === '' || v === null || v === undefined ? undefined : v))
    .pipe(z.uuid({ error: '无效的分类 ID' }).optional())
    .optional(),
  search: z.string().max(200).optional(),
})

export const articleRoutes: FastifyPluginAsync = async (server) => {
  server.get('/articles', async (request, reply) => {
    const parsed = articlesQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const pageSize = parsed.data.limit ?? parsed.data.pageSize
    const result = await findPublishedArticles({
      page: parsed.data.page,
      pageSize,
      categoryId: parsed.data.categoryId,
      search: parsed.data.search,
    })
    return withPublicEdgeCache(reply).send(success(result.list.map(withAppContract)))
  })

  // GET /articles/rss.xml - 企鹅号等内容同步的公开 RSS 源（必须在 /articles/:id 之前注册）
  server.get('/articles/rss.xml', async (_request, reply) => {
    const result = await findPublishedArticles({ page: 1, pageSize: 20 })
    const now = toBeijingRfc2822(new Date())
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    const items = result.list
      .filter((article) => {
        const published = new Date(article.publishedAt ?? article.createdAt).getTime()
        return Number.isFinite(published) && published >= cutoff
      })
      .slice(0, 1)
      .map((article) => {
        const link = `${RSS_SITE_URL}/articles/${article.id}`
        const publishedAt = toBeijingRfc2822(article.publishedAt ?? article.createdAt)
        const description = markdownToHtml(article.content?.trim() || article.summary?.trim() || '')
        return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${publishedAt}</pubDate>
      <author>${escapeXml(article.authorName ?? 'IHUI AI 编辑')}</author>
      <description>${description}</description>
    </item>`
      })
      .join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(RSS_TITLE)}</title>
    <link>${RSS_SITE_URL}</link>
    <description>${escapeXml(RSS_DESCRIPTION)}</description>
    <language>zh-cn</language>
    <lastBuildDate>${now}</lastBuildDate>
    <pubDate>${now}</pubDate>
    <generator>IHUI AI Articles RSS</generator>
    <ttl>30</ttl>
${items}
  </channel>
</rss>`

    return reply
      .header('Content-Type', 'application/xml; charset=utf-8')
      .header('Cache-Control', 'no-store, max-age=0')
      .send(xml)
  })

  // GET /articles/:id - 文章详情(RN 端消费;与 /news/articles/:id 同一张表、同一个查询函数)。
  // 这条路由 2026-10-26 之前不存在,而 RN ArticleDetailScreen 早就在打它
  // (apps/mobile-rn/src/screens/ArticleDetailScreen.tsx:82)、watch-aspect.ts:27 也早已
  // 预置了该 URL 的浏览计数拦截 ⇒ 详情链路 100% 404。视图计数由 watch-aspect 的 preHandler
  // 统一自增,本路由不自增(重复自增 = 一次浏览计两次)。
  server.get('/articles/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const article = await findArticleById(parsed.data.id)
    if (!article || !article.isPublished) {
      return reply.status(404).send(error(404, '文章不存在'))
    }
    return reply.send(success(withAppContract(article)))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
