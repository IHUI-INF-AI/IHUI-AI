import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { UseCaseContent } from '../UseCaseContent'
import { generateReviewSchema, type ReviewSchema } from '@/lib/seo/schema-review'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/use-cases/customer-support#webpage',
      url: 'https://aizhs.top/use-cases/customer-support',
      name: 'AI 智能客服 Agent 用例 — IHUI AI',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的智能客服 Agent:7×24 在线,统一知识库,多模型智能路由,多渠道部署,人机协同。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/use-cases/customer-support#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://aizhs.top/use-cases' },
        { '@type': 'ListItem', position: 3, name: '智能客服', item: 'https://aizhs.top/use-cases/customer-support' },
      ],
    },
    // 2026-07-26 GEO 强化:HowTo schema(适配 AI 引擎"如何搭建智能客服 Agent"类检索)
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/use-cases/customer-support#howto',
      name: '5 分钟搭建 7×24 智能客服 Agent',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建智能客服 Agent 的 4 步流程:上传知识库 → 配置 Agent → 多渠道发布 → 持续优化。成本降低 70%,响应 0 秒。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      totalTime: 'PT5M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '产品手册/FAQ/历史工单' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 知识库 RAG 模块' },
        { '@type': 'HowToTool', name: 'IHUI AI Agent 设计器' },
      ],
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: '上传知识库',
          text: '导入产品手册/FAQ/历史工单,AI 自动向量化,5 分钟即可上线。',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: '配置 Agent',
          text: '从客服场景模板 fork,配置欢迎语/转人工规则/品牌话术。',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: '多渠道发布',
          text: '一键发布到 Web/微信/小程序/邮件,所有渠道共享同一知识库。',
        },
        {
          '@type': 'HowToStep',
          position: 4,
          name: '持续优化',
          text: '查看对话日志,标注 AI 错误答案,系统自动迭代知识库。',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 智能客服 Agent 用例 — 7×24 高质量服务 | IHUI AI',
  description:
    '基于 IHUI AI 全栈 AI 操作系统搭建的智能客服 Agent:7×24 在线响应、统一知识库、多模型路由、多渠道部署、人机协同,成本降低 70%,响应时间 0 秒。',
  alternates: { canonical: '/use-cases/customer-support' },
  openGraph: {
    title: 'AI 智能客服 Agent — 7×24 高质量服务体验',
    description: '成本降低 70%,响应 0 秒,80% 问题 AI 解决。',
    url: 'https://aizhs.top/use-cases/customer-support',
    type: 'article',
  },
}

export default async function CustomerSupportPage() {
  // 2026-07-26 GEO 强化:Review schema(适配 AI 引擎对"智能客服"客户评价的结构化抓取)
  let reviewJsonLd: ReviewSchema | null = null
  try {
    const reviewT = await getTranslations('useCasesCustomerSupport.reviewSchema')
    reviewJsonLd = generateReviewSchema({
      itemReviewedName: reviewT('itemReviewed'),
      itemReviewedUrl: 'https://aizhs.top/use-cases/customer-support',
      reviewBody: reviewT('reviewBody'),
      ratingValue: Number(reviewT('reviewRating.ratingValue')),
      authorName: reviewT('author'),
      authorJobTitle: reviewT('authorJobTitle'),
      authorAffiliation: reviewT('authorAffiliation'),
      datePublished: reviewT('datePublished'),
      inLanguage: 'zh-CN',
    })
  } catch {
    reviewJsonLd = null
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {reviewJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewJsonLd) }}
        />
      ) : null}
      <UseCaseContent useCaseId="customer-support" />
    </>
  )
}
