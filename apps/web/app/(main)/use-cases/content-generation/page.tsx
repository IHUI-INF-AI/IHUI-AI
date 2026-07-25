import type { Metadata } from 'next'
import { UseCaseContent } from '../UseCaseContent'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/use-cases/content-generation#webpage',
      url: 'https://ihui.ai/use-cases/content-generation',
      name: 'AI 内容创作 Agent 用例 — IHUI AI',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的内容创作 Agent:一键多平台改写,SEO 智能优化,多语言本地化,品牌调性统一,数据驱动迭代。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: { '@id': 'https://ihui.ai/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/use-cases/content-generation#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://ihui.ai/use-cases' },
        { '@type': 'ListItem', position: 3, name: '内容创作', item: 'https://ihui.ai/use-cases/content-generation' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 内容创作 Agent 用例 — 产能 ×10 | IHUI AI',
  description:
    '基于 IHUI AI 全栈 AI 操作系统搭建的内容创作 Agent:一键多平台改写(微信公众号/知乎/小红书/抖音),多语言本地化(5 语言),品牌调性统一,内容产能提升 10 倍。',
  alternates: { canonical: '/use-cases/content-generation' },
  openGraph: {
    title: 'AI 内容创作 — 多平台多语言一键产出',
    description: '产能 ×10,多语言成本 -80%,5 平台一键改写。',
    url: 'https://ihui.ai/use-cases/content-generation',
    type: 'article',
  },
}

export default function ContentGenerationPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <UseCaseContent useCaseId="content-generation" />
    </>
  )
}
