import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-spark#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-spark',
      name: 'IHUI AI vs 讯飞星火:全栈 Agent OS vs 教育/语音 AI',
      description:
        '讯飞星火偏教育/语音 AI;IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,跨行业+30+ 模型+Agent 市场+六端分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'iFlytek Spark / 讯飞星火' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-spark#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs 讯飞星火', item: 'https://aizhs.top/compare/ihui-vs-spark' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs 讯飞星火:全栈 Agent OS vs 教育/语音 AI | 2026 对比',
  description:
    '讯飞星火偏教育/语音 AI(星火大模型+讯飞语音);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,跨行业+30+ 模型+Agent 市场+六端分发。本文 9 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-spark' },
  openGraph: {
    title: 'IHUI AI vs 讯飞星火 — 全栈跨行业 vs 教育/语音',
    description: '跨行业 + 30+ 模型 vs 教育语音锁定。',
    url: 'https://aizhs.top/compare/ihui-vs-spark',
    type: 'article',
  },
}

export default function CompareSparkPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="spark" />
    </>
  )
}
