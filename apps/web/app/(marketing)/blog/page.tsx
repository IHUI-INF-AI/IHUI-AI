import type { Metadata } from 'next'
import { BlogContent } from './BlogContent'

/**
 * 博客聚合页(/blog)
 *
 * - Server Component,导出 metadata 用于 SEO
 * - 渲染 <BlogContent />(客户端组件,含分类筛选)
 * - 沿用 (marketing) 路由组布局
 * - 展示 docs/blog/ 下 10 篇 SEO 技术博客,提升长尾流量
 */
export const metadata: Metadata = {
  title: '博客',
  description: 'IHUI AI 技术博客 — AI Agent / LLM / RAG / MCP / 8 端架构 / 开源变现实战分享',
  openGraph: {
    title: '博客 | 智汇 AI',
    description: 'IHUI AI 技术博客 — AI Agent / LLM / RAG / MCP / 8 端架构 / 开源变现实战分享',
    type: 'website',
  },
}

export default function BlogPage() {
  return <BlogContent />
}