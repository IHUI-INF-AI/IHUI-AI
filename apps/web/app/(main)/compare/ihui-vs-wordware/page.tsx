import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/compare/ihui-vs-wordware#webpage',
      url: 'https://ihui.ai/compare/ihui-vs-wordware',
      name: 'IHUI AI vs Wordware:零代码全栈 OS vs 可读 AI 编程',
      description:
        'Wordware 是可读 AI 编程语言;IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,零代码可视化+200+ 模板+六端分发+团队协作。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: [
        { '@id': 'https://ihui.ai/#organization' },
        { '@type': 'Thing', name: 'Wordware' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/compare/ihui-vs-wordware#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://ihui.ai/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs Wordware', item: 'https://ihui.ai/compare/ihui-vs-wordware' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Wordware:零代码全栈 OS vs 可读 AI 编程 | 2026 对比',
  description:
    'Wordware 是可读 AI 编程语言(类自然语言);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,零代码可视化+200+ 模板+六端分发+团队协作。本文 8 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-wordware' },
  openGraph: {
    title: 'IHUI AI vs Wordware — 零代码 OS vs 可读编程',
    description: '可视化 + 200+ 模板 vs 类自然语言编程。',
    url: 'https://ihui.ai/compare/ihui-vs-wordware',
    type: 'article',
  },
}

export default function CompareWordwarePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="wordware" />
    </>
  )
}
