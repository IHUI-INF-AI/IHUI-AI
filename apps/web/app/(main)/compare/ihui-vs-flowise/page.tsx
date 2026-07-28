import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-flowise#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-flowise',
      name: 'IHUI AI vs Flowise:全栈 AI 操作系统 vs 可视化 LangChain',
      description:
        'Flowise 是开源可视化 LangChain 应用构建器(Web 拖拽);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含可视化 + Agent 市场 + 六端分发 + 团队协作。本文深度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'Flowise' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-flowise#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs Flowise', item: 'https://aizhs.top/compare/ihui-vs-flowise' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Flowise:全栈 AI 操作系统 vs 可视化 LangChain | 2026 对比',
  description:
    'Flowise 是可视化 LangChain 拖拽构建器(仅 Web);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含可视化 + Agent 市场 + 知识库 RAG + 六端分发 + 团队协作。本文 11 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-flowise' },
  openGraph: {
    title: 'IHUI AI vs Flowise — 全栈 OS vs 可视化 LangChain',
    description: 'Agent 市场 + 跨端 + 协作 vs Web 拖拽流程。',
    url: 'https://aizhs.top/compare/ihui-vs-flowise',
    type: 'article',
  },
}

export default function CompareFlowisePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="flowise" />
    </>
  )
}
