import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-make#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-make',
      name: 'IHUI AI vs Make.com:AI 优先全栈 OS vs 可视化自动化',
      description:
        'Make.com 是可视化自动化平台;IHUI AI 是 Apache 2.0 开源 AI 优先全栈操作系统,LLM/Agent 为核心+知识库+六端分发+私有化。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [{ '@id': 'https://aizhs.top/#organization' }, { '@type': 'Thing', name: 'Make.com' }],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-make#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'IHUI AI vs Make.com',
          item: 'https://aizhs.top/compare/ihui-vs-make',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Make.com:AI 优先全栈 OS vs 可视化自动化 | 2026 对比',
  description:
    'Make.com 是可视化自动化平台(1800+ app);IHUI AI 是 Apache 2.0 开源 AI 优先全栈操作系统,LLM/Agent 为核心+知识库+六端分发+私有化。本文 8 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-make' },
  openGraph: {
    title: 'IHUI AI vs Make.com — AI-native vs 可视化自动化',
    description: 'AI 优先 + 六端 vs 可视化场景。',
    url: 'https://aizhs.top/compare/ihui-vs-make',
    type: 'article',
  },
}

export default function CompareMakePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="make" />
    </>
  )
}
