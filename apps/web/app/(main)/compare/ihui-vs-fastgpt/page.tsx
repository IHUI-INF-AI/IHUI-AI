import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-fastgpt#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-fastgpt',
      name: 'IHUI AI vs FastGPT:全栈 AI 操作系统 vs 知识库 Q&A 工具',
      description:
        'FastGPT 专注知识库 Q&A,IHUI AI 是含知识库的全栈 AI 操作系统,集成 Agent 市场 + 多端分发 + 团队协作。本文从 RAG、Agent、客户端、协作 11 个维度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [{ '@id': 'https://aizhs.top/#organization' }, { '@type': 'Thing', name: 'FastGPT' }],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-fastgpt#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'IHUI AI vs FastGPT',
          item: 'https://aizhs.top/compare/ihui-vs-fastgpt',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs FastGPT:全栈 AI 平台 vs 知识库 Q&A 工具 | 2026 对比',
  description:
    'FastGPT 专注知识库 Q&A,IHUI AI 是含知识库的全栈 AI 操作系统,还包含 Agent 市场、六端分发、MCP 工具、团队协作。如果你的需求不止 Q&A,IHUI AI 是更完整方案。',
  alternates: { canonical: '/compare/ihui-vs-fastgpt' },
  openGraph: {
    title: 'IHUI AI vs FastGPT — 知识库只是开始',
    description: 'FastGPT 偏 Q&A,IHUI AI 含知识库 + Agent + 六端 + 团队协作。',
    url: 'https://aizhs.top/compare/ihui-vs-fastgpt',
    type: 'article',
  },
}

export default function CompareFastgptPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="fastgpt" />
    </>
  )
}
