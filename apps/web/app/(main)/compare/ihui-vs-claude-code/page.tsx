import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-claude-code#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-claude-code',
      name: 'IHUI AI vs Claude Code:全栈 AI 操作系统 vs 终端内 AI 编程助手',
      description:
        'Claude Code 是 Anthropic 出品的终端内 AI 编程助手(2025 现象级产品,仅 CLI);IHUI AI 是 Apache 2.0 开源的全栈 AI 操作系统,含代码 Agent + Agent 市场 + 知识库 + 六端分发。本文深度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'Claude Code' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-claude-code#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'IHUI AI vs Claude Code',
          item: 'https://aizhs.top/compare/ihui-vs-claude-code',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Claude Code:全栈 AI 操作系统 vs 终端内 AI 编程助手 | 2026 对比',
  description:
    'Claude Code 是 Anthropic 出品的终端内 AI 编程助手(仅 CLI,锁定 Claude 模型);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,含代码 Agent + Agent 市场 + 知识库 + 六端分发。本文 12 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-claude-code' },
  openGraph: {
    title: 'IHUI AI vs Claude Code — 全栈 AI OS vs 终端编程助手',
    description: '六端同源 AI 操作系统 vs CLI only 编程助手;开源可商用 vs 闭源 SaaS。',
    url: 'https://aizhs.top/compare/ihui-vs-claude-code',
    type: 'article',
  },
}

export default function CompareClaudeCodePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="claude-code" />
    </>
  )
}
