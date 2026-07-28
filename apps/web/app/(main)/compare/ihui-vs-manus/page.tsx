import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-manus#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-manus',
      name: 'IHUI AI vs Manus:可复用 Agent 操作系统 vs 单任务自主 Agent',
      description:
        'Manus 是单任务自主 AI Agent(2025 现象级产品,跑一次性研究任务);IHUI AI 是 Apache 2.0 开源的全栈 AI 操作系统,支持可复用 Agent + Agent 市场 + 跨端分发。本文深度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'Manus AI' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-manus#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs Manus', item: 'https://aizhs.top/compare/ihui-vs-manus' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Manus AI:可复用 Agent 操作系统 vs 单任务自主 Agent | 2026 对比',
  description:
    'Manus 是单任务自主 Agent(任务结束即销毁,无复用);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,支持可复用 Agent + Agent 市场 + 200+ 模板 + 跨端分发。本文 11 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-manus' },
  openGraph: {
    title: 'IHUI AI vs Manus — 可复用 vs 单任务',
    description: 'Agent 操作系统 vs 一次性自主 Agent;开源可商用 vs 邀请制闭源。',
    url: 'https://aizhs.top/compare/ihui-vs-manus',
    type: 'article',
  },
}

export default function CompareManusPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="manus" />
    </>
  )
}
