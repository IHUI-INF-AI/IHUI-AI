import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-kimi-platform#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-kimi-platform',
      name: 'IHUI AI vs Kimi:全栈 Agent OS vs 长文本 AI 助手',
      description:
        'Kimi 是月之暗面长文本对话王者(200 万字);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,可接入 Kimi 模型+Agent 市场+知识库+六端分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'Kimi / 月之暗面' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-kimi-platform#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs Kimi', item: 'https://aizhs.top/compare/ihui-vs-kimi-platform' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Kimi:全栈 Agent OS vs 长文本 AI 助手 | 2026 对比',
  description:
    'Kimi 是月之暗面长文本对话王者(200 万字);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,可接入 Kimi 模型+Agent 市场+知识库+六端分发。本文 9 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-kimi-platform' },
  openGraph: {
    title: 'IHUI AI vs Kimi — 全栈 OS vs 长文本助手',
    description: 'Agent 编排 + 六端分发 vs 长文本对话。',
    url: 'https://aizhs.top/compare/ihui-vs-kimi-platform',
    type: 'article',
  },
}

export default function CompareKimiPlatformPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="kimi-platform" />
    </>
  )
}
