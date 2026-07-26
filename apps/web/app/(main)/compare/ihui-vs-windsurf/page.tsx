import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/compare/ihui-vs-windsurf#webpage',
      url: 'https://ihui.ai/compare/ihui-vs-windsurf',
      name: 'IHUI AI vs Windsurf:全栈 AI 操作系统 vs Codeium AI IDE',
      description:
        'Windsurf 是 Codeium 出品的 AI 优先 IDE(2025 现象级产品,专注代码补全 + Cascade Agent);IHUI AI 是 Apache 2.0 开源的全栈 AI 操作系统,含代码 Agent + Agent 市场 + 知识库 + 六端分发。本文深度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: [
        { '@id': 'https://ihui.ai/#organization' },
        { '@type': 'Thing', name: 'Windsurf IDE' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/compare/ihui-vs-windsurf#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://ihui.ai/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs Windsurf', item: 'https://ihui.ai/compare/ihui-vs-windsurf' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Windsurf:全栈 AI 操作系统 vs Codeium AI IDE | 2026 对比',
  description:
    'Windsurf 是 Codeium 出品 AI IDE(桌面 only,无 Agent 市场/工作流/私有化);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含代码 Agent + Agent 市场 + 知识库 + 六端分发。本文 12 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-windsurf' },
  openGraph: {
    title: 'IHUI AI vs Windsurf — 全栈 AI OS vs Codeium AI IDE',
    description: '六端同源 AI 操作系统 vs 桌面 IDE only;开源可商用 vs 闭源 SaaS。',
    url: 'https://ihui.ai/compare/ihui-vs-windsurf',
    type: 'article',
  },
}

export default function CompareWindsurfPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="windsurf" />
    </>
  )
}
