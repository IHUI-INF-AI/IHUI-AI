import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-openai-agent#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-openai-agent',
      name: 'IHUI AI vs OpenAI Agent Builder:多模型中立 vs OpenAI 生态锁定',
      description:
        'OpenAI Agent Builder 锁定 OpenAI 模型(高成本、闭源、不支持私有化);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,支持 30+ 模型中立调度、跨云部署、数据自有。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'OpenAI Agent Builder' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-openai-agent#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'IHUI AI vs OpenAI Agent Builder',
          item: 'https://aizhs.top/compare/ihui-vs-openai-agent',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs OpenAI Agent Builder:多模型中立 vs OpenAI 锁定 | 2026 对比',
  description:
    'OpenAI Agent Builder 只能用 OpenAI 模型(成本高、闭源、不支持私有化);IHUI AI 是 Apache 2.0 开源,支持 GPT-4o/Claude/Gemini/DeepSeek/Qwen 等 30+ 模型中立调度。本文 11 维度深度对比。',
  alternates: { canonical: '/compare/ihui-vs-openai-agent' },
  openGraph: {
    title: 'IHUI AI vs OpenAI Agent Builder — 避免 OpenAI 生态锁定',
    description: '多模型中立 vs OpenAI 锁定;开源 vs 闭源;数据自有 vs 数据过 OpenAI。',
    url: 'https://aizhs.top/compare/ihui-vs-openai-agent',
    type: 'article',
  },
}

export default function CompareOpenAIAgentPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="openai-agent" />
    </>
  )
}
