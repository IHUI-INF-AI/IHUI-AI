import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/compare/ihui-vs-bolt-new#webpage',
      url: 'https://ihui.ai/compare/ihui-vs-bolt-new',
      name: 'IHUI AI vs Bolt.new:全栈 AI 操作系统 vs 浏览器内全栈应用生成',
      description:
        'Bolt.new 是 StackBlitz 出品的浏览器内全栈应用生成工具(2025 现象级产品);IHUI AI 是 Apache 2.0 开源的全栈 AI 操作系统,含代码 Agent + Agent 市场 + 知识库 + 六端分发。本文深度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: [
        { '@id': 'https://ihui.ai/#organization' },
        { '@type': 'Thing', name: 'Bolt.new' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/compare/ihui-vs-bolt-new#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://ihui.ai/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs Bolt.new', item: 'https://ihui.ai/compare/ihui-vs-bolt-new' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Bolt.new:全栈 AI 操作系统 vs 浏览器内应用生成 | 2026 对比',
  description:
    'Bolt.new 是浏览器内全栈应用生成(Web only,无 Agent 市场/团队协作/私有化);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含代码 Agent + Agent 市场 + 知识库 + 六端分发。本文 12 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-bolt-new' },
  openGraph: {
    title: 'IHUI AI vs Bolt.new — 全栈 AI OS vs 浏览器应用生成',
    description: '六端同源 AI 操作系统 vs Web only;开源可商用 vs 闭源 SaaS。',
    url: 'https://ihui.ai/compare/ihui-vs-bolt-new',
    type: 'article',
  },
}

export default function CompareBoltNewPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="bolt-new" />
    </>
  )
}
