import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-autogen#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-autogen',
      name: 'IHUI AI vs Microsoft AutoGen:全栈 AI 操作系统 vs 多 Agent 代码框架',
      description:
        'Microsoft AutoGen 是多 Agent 对话编排的 Python SDK;IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含可视化 Agent 市场 + 知识库 RAG + 六端分发 + 团队协作。本文深度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'Microsoft AutoGen' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-autogen#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs AutoGen', item: 'https://aizhs.top/compare/ihui-vs-autogen' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Microsoft AutoGen:全栈 AI 操作系统 vs 多 Agent 代码框架 | 2026 对比',
  description:
    'AutoGen 是 Microsoft 开源的多 Agent 对话 SDK(需写代码);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含可视化 Agent 市场 + 知识库 RAG + 六端分发 + 团队协作。本文 11 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-autogen' },
  openGraph: {
    title: 'IHUI AI vs AutoGen — 生产就绪 OS vs 研究 SDK',
    description: '可视化 + Agent 市场 + 跨端 vs Python 多 Agent 代码框架。',
    url: 'https://aizhs.top/compare/ihui-vs-autogen',
    type: 'article',
  },
}

export default function CompareAutoGenPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="autogen" />
    </>
  )
}
