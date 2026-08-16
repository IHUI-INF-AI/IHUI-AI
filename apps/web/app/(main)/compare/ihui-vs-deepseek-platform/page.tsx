import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-deepseek-platform#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-deepseek-platform',
      name: 'IHUI AI vs DeepSeek Platform:全栈 Agent OS vs 推理模型 API',
      description:
        'DeepSeek 是推理模型 API;IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含 DeepSeek+30+ 模型+Agent 编排+知识库+六端分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'DeepSeek Platform' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-deepseek-platform#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'IHUI AI vs DeepSeek Platform',
          item: 'https://aizhs.top/compare/ihui-vs-deepseek-platform',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs DeepSeek Platform:全栈 Agent OS vs 推理模型 API | 2026 对比',
  description:
    'DeepSeek 是推理模型 API(V3/R1 极低价);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含 DeepSeek+30+ 模型+Agent 编排+知识库+六端分发。本文 9 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-deepseek-platform' },
  openGraph: {
    title: 'IHUI AI vs DeepSeek — 全栈 OS vs 模型 API',
    description: 'Agent 编排 + 六端 vs 纯模型 API。',
    url: 'https://aizhs.top/compare/ihui-vs-deepseek-platform',
    type: 'article',
  },
}

export default function CompareDeepseekPlatformPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="deepseek-platform" />
    </>
  )
}
