import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-github-copilot#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-github-copilot',
      name: 'IHUI AI vs GitHub Copilot:全栈 AI 操作系统 vs AI 编程助手插件',
      description:
        'GitHub Copilot 是老牌 AI 编程助手(IDE 插件,深度集成 VS Code);IHUI AI 是 Apache 2.0 开源的全栈 AI 操作系统,含代码 Agent + Agent 市场 + 知识库 + 六端分发。本文深度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'GitHub Copilot' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-github-copilot#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'IHUI AI vs GitHub Copilot',
          item: 'https://aizhs.top/compare/ihui-vs-github-copilot',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs GitHub Copilot:全栈 AI 操作系统 vs AI 编程助手 | 2026 对比',
  description:
    'GitHub Copilot 是老牌 AI 编程助手(IDE 插件 only,无 Agent 市场/工作流/私有化);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含代码 Agent + Agent 市场 + 知识库 + 六端分发。本文 12 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-github-copilot' },
  openGraph: {
    title: 'IHUI AI vs GitHub Copilot — 全栈 AI OS vs 编程助手插件',
    description: '六端同源 AI 操作系统 vs IDE 插件 only;开源可商用 vs 闭源 SaaS。',
    url: 'https://aizhs.top/compare/ihui-vs-github-copilot',
    type: 'article',
  },
}

export default function CompareGithubCopilotPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="github-copilot" />
    </>
  )
}
