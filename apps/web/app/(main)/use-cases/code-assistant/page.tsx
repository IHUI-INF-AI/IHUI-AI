import type { Metadata } from 'next'
import { UseCaseContent } from '../UseCaseContent'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/use-cases/code-assistant#webpage',
      url: 'https://ihui.ai/use-cases/code-assistant',
      name: 'AI 代码助手 Agent 用例 — IHUI AI',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的代码助手 Agent:团队代码库 RAG,智能 Code Review,新人 7×24 导师,多 IDE 集成,私有化部署。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: { '@id': 'https://ihui.ai/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/use-cases/code-assistant#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://ihui.ai/use-cases' },
        { '@type': 'ListItem', position: 3, name: '代码助手', item: 'https://ihui.ai/use-cases/code-assistant' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 代码助手 Agent 用例 — 团队开发效率 +50% | IHUI AI',
  description:
    '基于 IHUI AI 全栈 AI 操作系统搭建的代码助手 Agent:团队代码库 RAG,智能 Code Review,新人 1 周上手,多 IDE 集成(MCP),私有化部署代码不出域。',
  alternates: { canonical: '/use-cases/code-assistant' },
  openGraph: {
    title: 'AI 代码助手 — 让团队开发效率提升 50%',
    description: '新人 1 周上手,Code Review 时间 -50%,代码规范 100%。',
    url: 'https://ihui.ai/use-cases/code-assistant',
    type: 'article',
  },
}

export default function CodeAssistantPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <UseCaseContent useCaseId="code-assistant" />
    </>
  )
}
