import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-llamaindex#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-llamaindex',
      name: 'IHUI AI vs LlamaIndex:全栈 AI 操作系统 vs 数据连接 RAG 框架',
      description:
        'LlamaIndex 是专业的数据连接 + RAG 框架(Python/TS SDK);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含 RAG + Agent + 工作流 + 六端分发。本文深度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'LlamaIndex' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-llamaindex#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs LlamaIndex', item: 'https://aizhs.top/compare/ihui-vs-llamaindex' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs LlamaIndex:全栈 AI 操作系统 vs RAG 数据框架 | 2026 对比',
  description:
    'LlamaIndex 专注数据连接 + RAG 检索(专业 SDK);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含 RAG + Agent 市场 + 工作流 + 六端分发 + 团队协作。本文 11 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-llamaindex' },
  openGraph: {
    title: 'IHUI AI vs LlamaIndex — RAG + Agent + 跨端 vs 纯 RAG 框架',
    description: '全栈 AI 操作系统 vs 数据连接 + RAG SDK。',
    url: 'https://aizhs.top/compare/ihui-vs-llamaindex',
    type: 'article',
  },
}

export default function CompareLlamaIndexPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="llamaindex" />
    </>
  )
}
