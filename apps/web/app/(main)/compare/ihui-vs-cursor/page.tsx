import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/compare/ihui-vs-cursor#webpage',
      url: 'https://ihui.ai/compare/ihui-vs-cursor',
      name: 'IHUI AI vs Cursor:全栈 AI 操作系统 vs AI 优先 IDE',
      description:
        'Cursor 是 AI 优先 IDE(VS Code fork,2025 现象级产品,专注代码补全 + Chat);IHUI AI 是 Apache 2.0 开源的全栈 AI 操作系统,含代码 Agent + Agent 市场 + 知识库 + 六端分发。本文深度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: [
        { '@id': 'https://ihui.ai/#organization' },
        { '@type': 'Thing', name: 'Cursor IDE' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/compare/ihui-vs-cursor#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://ihui.ai/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs Cursor', item: 'https://ihui.ai/compare/ihui-vs-cursor' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Cursor:全栈 AI 操作系统 vs AI 优先 IDE | 2026 对比',
  description:
    'Cursor 是 AI 优先 IDE(VS Code fork,桌面 only,无 Agent 市场);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含代码 Agent + Agent 市场 + 知识库 + 六端分发 + 私有化。本文 12 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-cursor' },
  openGraph: {
    title: 'IHUI AI vs Cursor — 全栈 AI OS vs AI 优先 IDE',
    description: '六端同源 AI 操作系统 vs 桌面 IDE only;开源可商用 vs 闭源 SaaS。',
    url: 'https://ihui.ai/compare/ihui-vs-cursor',
    type: 'article',
  },
}

export default function CompareCursorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="cursor" />
    </>
  )
}
