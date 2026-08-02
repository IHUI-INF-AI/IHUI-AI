import type { Metadata } from 'next'
import { PricingContent } from './PricingContent'

export const metadata: Metadata = {
  title: 'VIP 会员定价',
  description:
    '智汇 AI 平台 VIP 会员 4 档定价方案:免费 / 个人 / 团队 / 企业,月付/年付灵活选择,年付享 2 个月免费。',
  alternates: {
    canonical: '/pricing',
    languages: {
      'x-default': '/pricing',
      en: '/en/pricing',
    },
  },
}

export default function PricingPage() {
  return <PricingContent />
}
