import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-qwen-platform#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-qwen-platform',
      name: 'IHUI AI vs 通义千问:跨 30+ 模型 Agent OS vs 阿里大模型平台',
      description:
        '通义千问是阿里大模型平台;IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,跨 30+ 模型中立+Agent 市场+六端分发+团队协作。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'Tongyi Qianwen / 通义千问' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-qwen-platform#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs 通义千问', item: 'https://aizhs.top/compare/ihui-vs-qwen-platform' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs 通义千问:跨 30+ 模型 Agent OS vs 阿里大模型平台 | 2026 对比',
  description:
    '通义千问是阿里大模型平台(模型 API+阿里云);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,跨 30+ 模型中立+Agent 市场+六端分发+团队协作。本文 9 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-qwen-platform' },
  openGraph: {
    title: 'IHUI AI vs 通义千问 — 跨模型 vs 锁定阿里',
    description: '30+ 模型中立 + Agent 市场 vs 阿里云锁定。',
    url: 'https://aizhs.top/compare/ihui-vs-qwen-platform',
    type: 'article',
  },
}

export default function CompareQwenPlatformPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="qwen-platform" />
    </>
  )
}
