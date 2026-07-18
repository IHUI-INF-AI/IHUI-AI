import * as React from 'react'
import type { Metadata } from 'next'
import { PricingContent, type Plan } from './PricingContent'

export const metadata: Metadata = {
  title: '定价方案',
  description:
    '智汇 AI 社区会员定价:早鸟价 ¥6000/人/年,原价 ¥18000。全年所有课程免费参加,探索活动优先参与,社群互助无限次。',
}

// 静态降级方案(API 不可用或未配置时使用)
export const FALLBACK_PLANS: Plan[] = [
  {
    name: '早鸟会员',
    price: '¥6000',
    originalPrice: '¥18000',
    period: '/人/年',
    desc: '限前 18 席,售完即恢复原价',
    features: [
      '全年所有课程免费参加',
      '探索活动优先参与',
      '社群互助无限次',
      '线上社群专属入口',
      'AI 助手优先体验',
      '不满意全额退款',
    ],
    cta: '立即加入',
    ctaHref: '/support?source=pricing',
    highlighted: true,
  },
  {
    name: '标准会员',
    price: '¥18000',
    period: '/人/年',
    desc: '早鸟售罄后自动切换至此方案',
    features: [
      '全年所有课程免费参加',
      '探索活动优先参与',
      '社群互助无限次',
      '线上社群专属入口',
      'AI 助手优先体验',
    ],
    cta: '了解详情',
    ctaHref: '/support?source=pricing-standard',
  },
  {
    name: '企业服务',
    price: '商务洽谈',
    period: '',
    desc: '面向企业决策者团队的定制方案',
    features: [
      '团队多席位套餐',
      '一对一 AI 顾问咨询',
      '企业 AI 文化落地陪跑',
      '专属定制课程',
      '私享闭门活动',
    ],
    cta: '联系商务',
    ctaHref: '/contact?source=pricing-enterprise',
  },
]

export default function PricingPage() {
  return <PricingContent fallbackPlans={FALLBACK_PLANS} />
}
