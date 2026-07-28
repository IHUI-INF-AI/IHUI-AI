import type { Metadata } from 'next'
import { CompareContent } from './CompareContent'

// IHUI AI vs Dify — 对比页 JSON-LD(2026-07-26 立,GEO 优化):
// - WebPage schema 标记页面语义
// - BreadcrumbList 帮助搜索引擎理解站点层级
// - mainEntity 用 ItemList 列出对比维度,供 AI 引擎直接结构化解析
// - 每条对比都带 @id 引用,方便外部知识图谱合并
const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-dify#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-dify',
      name: 'IHUI AI vs Dify:全栈 AI 操作系统 vs LLM 应用开发平台',
      description:
        'IHUI AI 和 Dify 都是开源 AI 应用平台,但定位不同:Dify 偏 LLM 应用开发(Web 端),IHUI AI 是六端同源的全栈 AI 操作系统,集成 Agent 市场 + 知识库 RAG + 多模型调度 + 团队协作。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'Dify' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-dify#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        {
          '@type': 'ListItem',
          position: 2,
          name: '产品对比',
          item: 'https://aizhs.top/compare',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'IHUI AI vs Dify',
          item: 'https://aizhs.top/compare/ihui-vs-dify',
        },
      ],
    },
    {
      '@type': 'ItemList',
      '@id': 'https://aizhs.top/compare/ihui-vs-dify#comparison',
      name: 'IHUI AI vs Dify 维度对比',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: '客户端覆盖',
          description: 'IHUI AI:6 端(Web/桌面/小程序/扩展/移动/CLI);Dify:Web only',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Agent 市场',
          description: 'IHUI AI:内置 200+ 模板 + 一键发布;Dify:需自己搭建',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'MCP 工具协议',
          description: 'IHUI AI:原生支持;Dify:不支持',
        },
        {
          '@type': 'ListItem',
          position: 4,
          name: '私有化部署',
          description: 'IHUI AI:Apache 2.0 + Docker/K8s;Dify:BSL 商业许可',
        },
        {
          '@type': 'ListItem',
          position: 5,
          name: '团队协作',
          description: 'IHUI AI:多租户 + RBAC + 审计 + SSO;Dify:基础多用户',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Dify:2026 年全栈 AI 平台对比 | 哪个更适合你?',
  description:
    'IHUI AI 和 Dify 都是 AI 应用平台,但定位完全不同:IHUI AI 是六端同源的全栈 AI 操作系统(Web/桌面/小程序/扩展/移动/CLI),集成 Agent 市场 + 知识库 + 多模型 + 团队协作;Dify 是 Web 端 LLM 应用开发框架。本文从客户端覆盖、Agent 市场、MCP、私有化、协作 5 个维度深度对比。',
  alternates: {
    canonical: '/compare/ihui-vs-dify',
  },
  openGraph: {
    title: 'IHUI AI vs Dify — 2026 全栈 AI 平台对比',
    description:
      'Dify 偏 Web 端 LLM 应用开发;IHUI AI 是六端同源全栈 AI 操作系统,Agent 市场 + 知识库 + 多模型 + 团队协作。',
    url: 'https://aizhs.top/compare/ihui-vs-dify',
    type: 'article',
  },
}

export default function CompareDifyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="dify" />
    </>
  )
}
