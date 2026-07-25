import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/compare/ihui-vs-typebot#webpage',
      url: 'https://ihui.ai/compare/ihui-vs-typebot',
      name: 'IHUI AI vs Typebot:全栈 AI 操作系统 vs 开源聊天机器人构建器',
      description:
        'Typebot 是开源聊天机器人构建器(表单/问卷流程);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含 AI Agent + 知识库 RAG + 工作流 + 六端分发。本文深度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: [
        { '@id': 'https://ihui.ai/#organization' },
        { '@type': 'Thing', name: 'Typebot' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/compare/ihui-vs-typebot#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://ihui.ai/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs Typebot', item: 'https://ihui.ai/compare/ihui-vs-typebot' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Typebot:全栈 AI 操作系统 vs 开源聊天机器人构建器 | 2026 对比',
  description:
    'Typebot 是开源聊天机器人构建器(可视化对话流程);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含 AI Agent + 知识库 RAG + 工作流 + 六端分发 + 团队协作。本文 11 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-typebot' },
  openGraph: {
    title: 'IHUI AI vs Typebot — 全栈 AI OS vs 聊天机器人构建器',
    description: 'Agent + RAG + 工作流 + 跨端 vs 聊天流程构建。',
    url: 'https://ihui.ai/compare/ihui-vs-typebot',
    type: 'article',
  },
}

export default function CompareTypebotPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="typebot" />
    </>
  )
}
