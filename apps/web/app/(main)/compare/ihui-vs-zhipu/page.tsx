import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/compare/ihui-vs-zhipu#webpage',
      url: 'https://ihui.ai/compare/ihui-vs-zhipu',
      name: 'IHUI AI vs 智谱清言:跨模型 Agent OS vs GLM 应用平台',
      description:
        '智谱清言是 GLM 模型应用平台;IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,跨模型(含 GLM)+Agent 市场+知识库+六端分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: [
        { '@id': 'https://ihui.ai/#organization' },
        { '@type': 'Thing', name: 'Zhipu Qingyan / 智谱清言' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/compare/ihui-vs-zhipu#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://ihui.ai/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs 智谱清言', item: 'https://ihui.ai/compare/ihui-vs-zhipu' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs 智谱清言:跨模型 Agent OS vs GLM 应用平台 | 2026 对比',
  description:
    '智谱清言是 GLM 模型应用平台;IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,跨模型(含 GLM)+Agent 市场+知识库+六端分发+团队协作。本文 9 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-zhipu' },
  openGraph: {
    title: 'IHUI AI vs 智谱清言 — 跨模型 vs 锁定 GLM',
    description: '30+ 模型中立 + 六端 vs GLM 锁定。',
    url: 'https://ihui.ai/compare/ihui-vs-zhipu',
    type: 'article',
  },
}

export default function CompareZhipuPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="zhipu" />
    </>
  )
}
