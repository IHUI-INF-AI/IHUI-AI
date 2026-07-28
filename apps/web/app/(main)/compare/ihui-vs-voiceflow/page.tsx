import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-voiceflow#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-voiceflow',
      name: 'IHUI AI vs Voiceflow:全栈 Agent OS vs 对话式 AI 平台',
      description:
        'Voiceflow 是对话式 AI 平台;IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,语音+文本+工作流+知识库+六端分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'Voiceflow' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-voiceflow#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs Voiceflow', item: 'https://aizhs.top/compare/ihui-vs-voiceflow' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Voiceflow:全栈 Agent OS vs 对话式 AI 平台 | 2026 对比',
  description:
    'Voiceflow 是对话式 AI 平台(语音+聊天设计);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,语音+文本+工作流+知识库+六端分发。本文 8 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-voiceflow' },
  openGraph: {
    title: 'IHUI AI vs Voiceflow — 全栈 OS vs 对话 AI',
    description: '全栈 Agent + 六端 vs 语音对话设计。',
    url: 'https://aizhs.top/compare/ihui-vs-voiceflow',
    type: 'article',
  },
}

export default function CompareVoiceflowPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="voiceflow" />
    </>
  )
}
