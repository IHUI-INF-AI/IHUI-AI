import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-replit-agent#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-replit-agent',
      name: 'IHUI AI vs Replit Agent:全栈 AI 操作系统 vs 云端 IDE + AI Agent',
      description:
        'Replit Agent 是云端 IDE + AI Agent(2025 现象级产品,专注云端开发 + 部署);IHUI AI 是 Apache 2.0 开源的全栈 AI 操作系统,含代码 Agent + Agent 市场 + 知识库 + 六端分发。本文深度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'Replit Agent' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-replit-agent#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'IHUI AI vs Replit Agent',
          item: 'https://aizhs.top/compare/ihui-vs-replit-agent',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Replit Agent:全栈 AI 操作系统 vs 云端 IDE Agent | 2026 对比',
  description:
    'Replit Agent 是云端 IDE + AI Agent(无私有化/六端分发/团队协作);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含代码 Agent + Agent 市场 + 知识库 + 六端分发。本文 12 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-replit-agent' },
  openGraph: {
    title: 'IHUI AI vs Replit Agent — 全栈 AI OS vs 云端 IDE Agent',
    description: '六端同源 AI 操作系统 vs Web + APP;开源可商用 vs 闭源 SaaS。',
    url: 'https://aizhs.top/compare/ihui-vs-replit-agent',
    type: 'article',
  },
}

export default function CompareReplitAgentPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="replit-agent" />
    </>
  )
}
