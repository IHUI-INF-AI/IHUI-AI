import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/compare/ihui-vs-minimax#webpage',
      url: 'https://ihui.ai/compare/ihui-vs-minimax',
      name: 'IHUI AI vs MiniMax:全栈 Agent OS vs 多模态模型 API',
      description:
        'MiniMax 是多模态大模型 API;IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含 MiniMax+30+ 模型+Agent 编排+六端分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: [
        { '@id': 'https://ihui.ai/#organization' },
        { '@type': 'Thing', name: 'MiniMax' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/compare/ihui-vs-minimax#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://ihui.ai/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs MiniMax', item: 'https://ihui.ai/compare/ihui-vs-minimax' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs MiniMax:全栈 Agent OS vs 多模态模型 API | 2026 对比',
  description:
    'MiniMax 是多模态大模型 API(文本/语音/视频);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含 MiniMax+30+ 模型+Agent 编排+六端分发。本文 9 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-minimax' },
  openGraph: {
    title: 'IHUI AI vs MiniMax — 全栈 OS vs 多模态 API',
    description: 'Agent 编排 + 六端 vs 多模态 API。',
    url: 'https://ihui.ai/compare/ihui-vs-minimax',
    type: 'article',
  },
}

export default function CompareMinimaxPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="minimax" />
    </>
  )
}
