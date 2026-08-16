import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-crewai#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-crewai',
      name: 'IHUI AI vs CrewAI:全栈 AI 操作系统 vs 角色扮演多 Agent 框架',
      description:
        'CrewAI 是角色扮演多 Agent 协作的 Python SDK;IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含可视化编排 + Agent 市场 + 知识库 RAG + 六端分发。本文深度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [{ '@id': 'https://aizhs.top/#organization' }, { '@type': 'Thing', name: 'CrewAI' }],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-crewai#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'IHUI AI vs CrewAI',
          item: 'https://aizhs.top/compare/ihui-vs-crewai',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs CrewAI:全栈 AI 操作系统 vs 角色扮演多 Agent 框架 | 2026 对比',
  description:
    'CrewAI 是角色扮演(Role-Playing)多 Agent 协作 SDK;IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含可视化编排 + Agent 市场 + 知识库 RAG + 六端分发 + 团队协作。本文 11 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-crewai' },
  openGraph: {
    title: 'IHUI AI vs CrewAI — 生产就绪 OS vs 角色 SDK',
    description: '可视化 + Agent 市场 + 跨端 vs Python 角色扮演框架。',
    url: 'https://aizhs.top/compare/ihui-vs-crewai',
    type: 'article',
  },
}

export default function CompareCrewAIPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="crewai" />
    </>
  )
}
