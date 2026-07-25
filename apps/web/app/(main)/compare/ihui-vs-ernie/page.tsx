import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/compare/ihui-vs-ernie#webpage',
      url: 'https://ihui.ai/compare/ihui-vs-ernie',
      name: 'IHUI AI vs 文心一言:企业级 Agent OS vs 百度 C 端 AI 助手',
      description:
        '文心一言是百度 C 端 AI 助手;IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含 Agent 市场+知识库 RAG+六端分发+团队协作。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: [
        { '@id': 'https://ihui.ai/#organization' },
        { '@type': 'Thing', name: 'ERNIE Bot / 文心一言' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/compare/ihui-vs-ernie#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://ihui.ai/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs 文心一言', item: 'https://ihui.ai/compare/ihui-vs-ernie' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs 文心一言:企业级 Agent OS vs 百度 C 端 AI 助手 | 2026 对比',
  description:
    '文心一言是百度 C 端 AI 助手(问答+百度生态);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含 Agent 市场+知识库 RAG+六端分发+团队协作。本文 9 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-ernie' },
  openGraph: {
    title: 'IHUI AI vs 文心一言 — 企业级 OS vs C 端助手',
    description: 'Agent 市场 + 私有化 + 六端 vs 百度生态问答。',
    url: 'https://ihui.ai/compare/ihui-vs-ernie',
    type: 'article',
  },
}

export default function CompareErniePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="ernie" />
    </>
  )
}
