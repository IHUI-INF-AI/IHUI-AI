import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-stack-ai#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-stack-ai',
      name: 'IHUI AI vs Stack AI:开源全栈 Agent OS vs 企业 AI 编排',
      description:
        'Stack AI 是企业 AI 编排平台;IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,Agent 市场+知识库+六端分发+私有化+团队协作。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'Stack AI' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-stack-ai#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs Stack AI', item: 'https://aizhs.top/compare/ihui-vs-stack-ai' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Stack AI:开源全栈 Agent OS vs 企业 AI 编排 | 2026 对比',
  description:
    'Stack AI 是企业 AI 编排平台(可视化工作流);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,Agent 市场+知识库+六端分发+私有化+团队协作。本文 8 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-stack-ai' },
  openGraph: {
    title: 'IHUI AI vs Stack AI — 开源全栈 vs 企业编排',
    description: '开源 + 六端 + Agent 市场 vs 闭源编排。',
    url: 'https://aizhs.top/compare/ihui-vs-stack-ai',
    type: 'article',
  },
}

export default function CompareStackAiPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="stack-ai" />
    </>
  )
}
