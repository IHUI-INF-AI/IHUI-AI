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
    // 2026-07-26 极致 GEO 强化:HowTo schema(适配 AI 引擎"如何搭建企业知识库 RAG"类检索)
    {
      '@type': 'HowTo',
      '@id': 'https://ihui.ai/use-cases/knowledge-base#howto',
      name: '60 秒搭建企业知识库 RAG 智能问答',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建企业知识库 RAG 的 4 步流程:连接数据源 → 智能解析 → 向量化索引 → 智能问答。找信息时间降低 70%,准确率 95%+。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      totalTime: 'PT60S',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '企业文档(PDF/Word/Markdown/Confluence/Notion)' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 数据源接入器' },
        { '@type': 'HowToTool', name: 'IHUI AI 向量索引引擎' },
      ],
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: '连接数据源',
          text: '对接 Confluence/Notion/SharePoint/S3 等 30+ 数据源,自动同步。',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: '智能解析',
          text: 'PDF 表格、Word 图片、Markdown 链接自动抽取,无信息丢失。',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: '向量化索引',
          text: '选择嵌入模型(支持中文优化版),构建混合索引,分钟级完成。',
        },
        {
          '@type': 'HowToStep',
          position: 4,
          name: '智能问答',
          text: '员工提问,AI 给出答案 + 引用来源,点击可跳转到原文段落。',
        },
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
