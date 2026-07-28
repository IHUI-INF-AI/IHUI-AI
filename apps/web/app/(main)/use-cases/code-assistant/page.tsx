import type { Metadata } from 'next'
import { UseCaseContent } from '../UseCaseContent'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/use-cases/code-assistant#webpage',
      url: 'https://aizhs.top/use-cases/code-assistant',
      name: 'AI 代码助手 Agent 用例 — IHUI AI',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的代码助手 Agent:团队代码库 RAG,智能 Code Review,新人 7×24 导师,多 IDE 集成,私有化部署。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/use-cases/code-assistant#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://aizhs.top/use-cases' },
        { '@type': 'ListItem', position: 3, name: '代码助手', item: 'https://aizhs.top/use-cases/code-assistant' },
      ],
    },
    // 2026-07-26 GEO 强化:HowTo schema(适配 AI 引擎"如何搭建团队 AI 代码助手"类检索)
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/use-cases/code-assistant#howto',
      name: '1 周搭建团队 AI 代码助手 Agent',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建代码助手 Agent 的 4 步流程:仓库索引 → Agent 训练 → IDE 集成 → PR 智能审查。Code Review 时间 -50%,新人 1 周上手。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      totalTime: 'P7D',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: 'GitHub/GitLab 仓库访问权限' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 代码库 RAG 模块' },
        { '@type': 'HowToTool', name: 'IHUI AI MCP Server(VSCode/Cursor/JetBrains)' },
      ],
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: '仓库索引',
          text: '连接 GitHub/GitLab,索引代码/Issue/PR/Wiki,自动同步。',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: 'Agent 训练',
          text: '从团队历史 PR/Code Review 中学习代码风格,自动生成团队规范文档。',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: 'IDE 集成',
          text: '通过 MCP Server 接入 VSCode/Cursor/JetBrains,代码补全/解释/重构一键完成。',
        },
        {
          '@type': 'HowToStep',
          position: 4,
          name: 'PR 智能审查',
          text: 'PR 提交时自动触发,AI 给出 review 意见,标记需要人类 review 的关键变更。',
        },
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
    url: 'https://aizhs.top/use-cases/code-assistant',
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
