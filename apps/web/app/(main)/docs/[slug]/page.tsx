// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { excerptFromContent } from '@/lib/content'
import { probeDocBySlug } from '@/lib/docs-slug-probe'

import PageClient from './PageClient'

interface PageProps {
  params: Promise<{ slug: string }>
}

/**
 * 服务端存在性探针(每次请求只问一次:generateMetadata 与 page 共用同一枚 cache 条目)。
 *
 * 正文取数仍放在客户端(与 help/[slug]、announcements/[id] 同形):服务端 RSC 只有在
 * NEXT_PUBLIC_API_BASE_URL 已配置时才拿得到绝对基址。这里唯一走服务端的是「这篇在不在」
 * 这一格 —— 取数可缓存(force-cache + revalidate 60,见 lib 常量注释)。
 */
const probeDoc = cache((slug: string) => probeDocBySlug(slug))

/**
 * 本路由**必须保持请求期动态渲染**,不要加 generateStaticParams,也不要加段级 revalidate。
 *
 * 2026-11-03 生产 500 的根因正是这里:上一版写了 `generateStaticParams(){ return [] }`,
 * Next 把路由记成「按需静态生成」(构建清单 ● /docs/[slug]),首访时在预渲染上下文里渲染;
 * 而根布局 app/layout.tsx 每请求都读 cookies()/headers()(语言与 CSP nonce),预渲染一碰
 * 动态 API 就把整次渲染判死 ⇒ 实测 digest=DYNAMIC_SERVER_USAGE ⇒ 生产**每一个** slug 都 500
 * (不止不存在的 slug;/docs/api、faq、getting-started 线上全是 500)。
 *
 * 硬 404 / 硬 500 不在这里落:页面侧 notFound()/抛错会被根段与 (main) 段的 loading.tsx
 * 流式外壳吞成 200,改由请求入口 Proxy 落状态码(见 src/lib/docs-detail-gate.ts)。
 */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  // 这里只取标题/摘要,不在这里判状态码(状态码统一由 Proxy 的 docs-detail-gate 落)。
  const { detail } = await probeDoc(slug)
  return {
    // 取不到标题就不写标题:把 slug 原样当标题写进 <title> 正是软 404 的那张脸
    title: detail?.doc.title,
    description: detail ? excerptFromContent(detail.doc.content) : undefined,
    alternates: { canonical: `/docs/${slug}` },
  }
}

export default async function DocsDetailPage({ params }: PageProps) {
  const { slug } = await params
  // 404/500 由 Proxy 落(见上方注释)。这里只负责「不存在就渲染 not-found 界面」,
  // 以及 Proxy 缺席时的兜底语义;'unknown'/'unauthorized' 一律按无正文渲染(客户端会回源)。
  const result = await probeDoc(slug)
  if (result.state === 'missing') notFound()
  return <PageClient initialDetail={result.detail} />
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
