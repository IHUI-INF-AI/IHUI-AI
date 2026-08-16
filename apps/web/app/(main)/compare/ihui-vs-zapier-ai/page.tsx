import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-zapier-ai#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-zapier-ai',
      name: 'IHUI AI vs Zapier AI:AI 优先全栈 OS vs 自动化集成平台',
      description:
        'Zapier 是自动化集成平台;IHUI AI 是 Apache 2.0 开源 AI 优先全栈操作系统,LLM/Agent 是一等公民+知识库+六端分发+团队协作。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'Zapier AI Actions' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-zapier-ai#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'IHUI AI vs Zapier AI',
          item: 'https://aizhs.top/compare/ihui-vs-zapier-ai',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Zapier AI:AI 优先全栈 OS vs 自动化集成平台 | 2026 对比',
  description:
    'Zapier 是自动化集成平台(7000+ SaaS);IHUI AI 是 Apache 2.0 开源 AI 优先全栈操作系统,LLM/Agent 是一等公民+知识库+六端分发+团队协作。本文 8 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-zapier-ai' },
  openGraph: {
    title: 'IHUI AI vs Zapier AI — AI-native vs 集成平台',
    description: 'LLM/Agent 一等公民 vs SaaS 集成。',
    url: 'https://aizhs.top/compare/ihui-vs-zapier-ai',
    type: 'article',
  },
}

export default function CompareZapierAiPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="zapier-ai" />
    </>
  )
}
