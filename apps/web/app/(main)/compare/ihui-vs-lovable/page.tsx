import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/compare/ihui-vs-lovable#webpage',
      url: 'https://ihui.ai/compare/ihui-vs-lovable',
      name: 'IHUI AI vs Lovable:全栈 AI 操作系统 vs 全栈应用生成',
      description:
        'Lovable 是全栈应用生成工具(prompt → 应用,2025 现象级产品,类似 Bolt.new);IHUI AI 是 Apache 2.0 开源的全栈 AI 操作系统,含代码 Agent + Agent 市场 + 知识库 + 六端分发。本文深度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: [
        { '@id': 'https://ihui.ai/#organization' },
        { '@type': 'Thing', name: 'Lovable AI' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/compare/ihui-vs-lovable#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://ihui.ai/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs Lovable', item: 'https://ihui.ai/compare/ihui-vs-lovable' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Lovable:全栈 AI 操作系统 vs 全栈应用生成 | 2026 对比',
  description:
    'Lovable 是全栈应用生成(Web only,无 Agent 市场/MCP/工作流);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含代码 Agent + Agent 市场 + 知识库 + 六端分发。本文 12 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-lovable' },
  openGraph: {
    title: 'IHUI AI vs Lovable — 全栈 AI OS vs 全栈应用生成',
    description: '六端同源 AI 操作系统 vs Web only;开源可商用 vs 闭源 SaaS。',
    url: 'https://ihui.ai/compare/ihui-vs-lovable',
    type: 'article',
  },
}

export default function CompareLovablePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="lovable" />
    </>
  )
}
