import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/compare/ihui-vs-n8n#webpage',
      url: 'https://ihui.ai/compare/ihui-vs-n8n',
      name: 'IHUI AI vs n8n:AI 优先的全栈平台 vs 通用工作流自动化',
      description:
        'n8n 是通用工作流自动化平台,AI 只是一个节点;IHUI AI 是 AI 优先的全栈操作系统,LLM/Agent/知识库是一等公民,工作流是其组件之一。本文从 AI 能力、Agent、知识库、客户端 11 个维度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: [
        { '@id': 'https://ihui.ai/#organization' },
        { '@type': 'Thing', name: 'n8n' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/compare/ihui-vs-n8n#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://ihui.ai/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs n8n', item: 'https://ihui.ai/compare/ihui-vs-n8n' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs n8n:AI 优先全栈 vs 通用工作流自动化 | 2026 对比',
  description:
    'n8n 通用工作流平台,AI 只是节点;IHUI AI 是 AI 优先全栈操作系统,LLM/Agent/Knowledge Base 是核心模块,工作流是其组件。如果你的工作流核心是 AI,IHUI AI 是更合适选择。',
  alternates: { canonical: '/compare/ihui-vs-n8n' },
  openGraph: {
    title: 'IHUI AI vs n8n — AI 优先 vs 通用工作流',
    description: 'n8n 偏工作流,AI 是节点;IHUI AI AI 优先,工作流是组件。',
    url: 'https://ihui.ai/compare/ihui-vs-n8n',
    type: 'article',
  },
}

export default function CompareN8nPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="n8n" />
    </>
  )
}
