import type { Metadata } from 'next'
import { UseCaseContent } from '../UseCaseContent'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/use-cases/customer-support#webpage',
      url: 'https://ihui.ai/use-cases/customer-support',
      name: 'AI 智能客服 Agent 用例 — IHUI AI',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的智能客服 Agent:7×24 在线,统一知识库,多模型智能路由,多渠道部署,人机协同。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: { '@id': 'https://ihui.ai/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/use-cases/customer-support#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://ihui.ai/use-cases' },
        { '@type': 'ListItem', position: 3, name: '智能客服', item: 'https://ihui.ai/use-cases/customer-support' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 智能客服 Agent 用例 — 7×24 极致服务 | IHUI AI',
  description:
    '基于 IHUI AI 全栈 AI 操作系统搭建的智能客服 Agent:7×24 在线响应、统一知识库、多模型路由、多渠道部署、人机协同,成本降低 70%,响应时间 0 秒。',
  alternates: { canonical: '/use-cases/customer-support' },
  openGraph: {
    title: 'AI 智能客服 Agent — 7×24 极致服务体验',
    description: '成本降低 70%,响应 0 秒,80% 问题 AI 解决。',
    url: 'https://ihui.ai/use-cases/customer-support',
    type: 'article',
  },
}

export default function CustomerSupportPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <UseCaseContent useCaseId="customer-support" />
    </>
  )
}
