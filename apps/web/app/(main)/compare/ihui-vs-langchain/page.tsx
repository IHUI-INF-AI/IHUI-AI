import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-langchain#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-langchain',
      name: 'IHUI AI vs LangChain / LangGraph:生产就绪 OS vs Python SDK 框架',
      description:
        'LangChain/LangGraph 是 Python SDK 框架,需要自己搭前后端数据库;IHUI AI 是完整生产就绪的全栈 AI 操作系统,30 分钟注册即可使用。本文深度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'LangChain' },
        { '@type': 'Thing', name: 'LangGraph' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-langchain#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'IHUI AI vs LangChain',
          item: 'https://aizhs.top/compare/ihui-vs-langchain',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs LangChain / LangGraph:OS vs SDK | 2026 对比',
  description:
    'LangChain 是 Python SDK 框架(需自己搭 UI/后端/数据库,2-3 天原型);IHUI AI 是完整生产就绪 OS(30 分钟注册,开箱即用,200+ Agent 模板)。本文 11 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-langchain' },
  openGraph: {
    title: 'IHUI AI vs LangChain — 完整 OS vs Python SDK',
    description: '开箱即用 vs 自己搭;30 分钟 vs 2-3 天;200+ 模板 vs 零模板。',
    url: 'https://aizhs.top/compare/ihui-vs-langchain',
    type: 'article',
  },
}

export default function CompareLangChainPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="langchain" />
    </>
  )
}
