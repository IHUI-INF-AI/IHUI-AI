import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-v0-dev#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-v0-dev',
      name: 'IHUI AI vs v0.dev:全栈 AI 操作系统 vs Vercel UI 组件生成',
      description:
        'v0.dev 是 Vercel 出品的 UI 组件生成工具(2025 现象级产品,专注 Next.js + Tailwind 前端);IHUI AI 是 Apache 2.0 开源的全栈 AI 操作系统,含代码 Agent + Agent 市场 + 知识库 + 六端分发。本文深度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [{ '@id': 'https://aizhs.top/#organization' }, { '@type': 'Thing', name: 'v0.dev' }],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-v0-dev#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'IHUI AI vs v0.dev',
          item: 'https://aizhs.top/compare/ihui-vs-v0-dev',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs v0.dev:全栈 AI 操作系统 vs Vercel UI 组件生成 | 2026 对比',
  description:
    'v0.dev 是 Vercel 出品 UI 组件生成(仅前端 UI,无后端/Agent 市场/团队协作);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含代码 Agent + Agent 市场 + 知识库 + 六端分发。本文 12 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-v0-dev' },
  openGraph: {
    title: 'IHUI AI vs v0.dev — 全栈 AI OS vs UI 组件生成',
    description: '六端同源 AI 操作系统 vs Web UI only;开源可商用 vs 闭源 SaaS。',
    url: 'https://aizhs.top/compare/ihui-vs-v0-dev',
    type: 'article',
  },
}

export default function CompareV0DevPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="v0-dev" />
    </>
  )
}
