import type { Metadata } from 'next'
import { UseCaseContent } from '../UseCaseContent'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/use-cases/content-generation#webpage',
      url: 'https://aizhs.top/use-cases/content-generation',
      name: 'AI 内容创作 Agent 用例 — IHUI AI',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的内容创作 Agent:一键多平台改写,SEO 智能优化,多语言本地化,品牌调性统一,数据驱动迭代。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/use-cases/content-generation#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://aizhs.top/use-cases' },
        {
          '@type': 'ListItem',
          position: 3,
          name: '内容创作',
          item: 'https://aizhs.top/use-cases/content-generation',
        },
      ],
    },
    // 2026-07-26 GEO 强化:HowTo schema(适配 AI 引擎"如何搭建 AI 内容创作流水线"类检索)
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/use-cases/content-generation#howto',
      name: '搭建多平台多语言 AI 内容创作流水线',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建内容创作 Agent 的 4 步流程:上传品牌资料 → 选题策划 → 一键生成 → 效果追踪。产能 ×10,多语言成本 -80%。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '品牌指南/历史爆款文章/产品文档' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 多模态生成模块' },
        { '@type': 'HowToTool', name: 'IHUI AI 多语言本地化引擎' },
      ],
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: '上传品牌资料',
          text: '上传品牌指南/历史爆款文章/产品文档,AI 学习品牌调性。',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: '选题策划',
          text: '输入关键词或行业趋势,AI 生成 20+ 选题方案 + 预估流量价值。',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: '一键生成',
          text: '选定选题,AI 生成多平台多语言版本,人工微调后发布。',
        },
        {
          '@type': 'HowToStep',
          position: 4,
          name: '效果追踪',
          text: '接入平台数据,AI 复盘高表现内容,持续优化生成策略。',
        },
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
    url: 'https://aizhs.top/use-cases/content-generation',
    type: 'article',
  },
}

export default function ContentGenerationPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <UseCaseContent useCaseId="content-generation" />
    </>
  )
}
