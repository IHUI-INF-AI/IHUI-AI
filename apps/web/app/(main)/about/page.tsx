import type { Metadata } from 'next'
import { AboutContent } from './AboutContent'

// AboutPage JSON-LD(2026-07-26 立,GEO 优化):
// - AboutPage schema 标记页面语义
// - BreadcrumbList 帮助搜索引擎理解站点层级
// - Organization 重复 root schema 的实体,通过 @id 引用合并
const aboutJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'AboutPage',
      '@id': 'https://ihui.ai/about#webpage',
      url: 'https://ihui.ai/about',
      name: '关于智汇 AI — 全栈 AI 操作系统',
      description:
        '智汇 AI(IHUI AI)是一站式全栈 AI 操作系统,集成 Agent 市场、知识库 RAG、多模型统一调度、MCP 工具协议,支持六端同源分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: { '@id': 'https://ihui.ai/#organization' },
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: 'https://ihui.ai/images/logo.png',
      },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/about#breadcrumb',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: '首页',
          item: 'https://ihui.ai',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: '关于智汇 AI',
          item: 'https://ihui.ai/about',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: '关于我们 — 智汇 AI | 全栈 AI 操作系统',
  description:
    '智汇 AI(IHUI AI)是一站式全栈 AI 操作系统:集成 Agent 市场、知识库 RAG、多模型统一调度、MCP 工具协议,支持 Web / 桌面 / 小程序 / 浏览器插件 / React Native / CLI 六端同源,Apache 2.0 开源,支持私有化部署。',
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: '关于智汇 AI — 全栈 AI 操作系统',
    description:
      '一码六端,一站 AI。智汇 AI(IHUI AI)是开源的全栈 AI 操作系统,把 Agent 设计、知识库、多模型调度、跨端协作装进同一个平台。',
    url: 'https://ihui.ai/about',
    type: 'website',
  },
}

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />
      <AboutContent />
    </>
  )
}
