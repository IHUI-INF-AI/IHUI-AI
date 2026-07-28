import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-relevance-ai#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-relevance-ai',
      name: 'IHUI AI vs Relevance AI:全栈 Agent OS vs AI Worker 平台',
      description:
        'Relevance AI 是 AI Worker 平台;IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,Agent 编排+知识库+六端分发+私有化+团队协作。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'Relevance AI' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-relevance-ai#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs Relevance AI', item: 'https://aizhs.top/compare/ihui-vs-relevance-ai' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Relevance AI:全栈 Agent OS vs AI Worker 平台 | 2026 对比',
  description:
    'Relevance AI 是 AI Worker 平台(构建 AI 跑任务);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,Agent 编排+知识库+六端分发+私有化+团队协作。本文 8 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-relevance-ai' },
  openGraph: {
    title: 'IHUI AI vs Relevance AI — 全栈 OS vs AI Worker',
    description: 'Agent 市场 + 六端 vs AI Worker 任务。',
    url: 'https://aizhs.top/compare/ihui-vs-relevance-ai',
    type: 'article',
  },
}

export default function CompareRelevanceAiPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="relevance-ai" />
    </>
  )
}
