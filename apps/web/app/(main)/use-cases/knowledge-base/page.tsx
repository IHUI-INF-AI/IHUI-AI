import type { Metadata } from 'next'
import { UseCaseContent } from '../UseCaseContent'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/use-cases/knowledge-base#webpage',
      url: 'https://ihui.ai/use-cases/knowledge-base',
      name: '企业知识库 RAG 用例 — IHUI AI',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的企业知识库 RAG:全量文档接入、向量 + BM25 混合检索、知识图谱、权限精细管控、多端问答。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: { '@id': 'https://ihui.ai/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/use-cases/knowledge-base#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://ihui.ai/use-cases' },
        { '@type': 'ListItem', position: 3, name: '企业知识库', item: 'https://ihui.ai/use-cases/knowledge-base' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: '企业知识库 RAG 用例 — 找信息时间 -70% | IHUI AI',
  description:
    '基于 IHUI AI 全栈 AI 操作系统搭建的企业知识库 RAG:30+ 数据源接入,向量 + BM25 混合检索,知识图谱,细粒度权限,找信息时间降低 70%,答案准确率 95%+。',
  alternates: { canonical: '/use-cases/knowledge-base' },
  openGraph: {
    title: '企业知识库 RAG — 让每个员工都拥有 AI 助手',
    description: '找信息时间 -70%,准确率 95%+,30+ 数据源接入。',
    url: 'https://ihui.ai/use-cases/knowledge-base',
    type: 'article',
  },
}

export default function KnowledgeBasePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <UseCaseContent useCaseId="knowledge-base" />
    </>
  )
}
