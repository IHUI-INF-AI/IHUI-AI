import type { Metadata } from 'next'
import { PricingContent } from './PricingContent'

export const metadata: Metadata = {
  title: '定价方案',
  description:
    '智汇 AI 社区会员定价:早鸟价 ¥6000/人/年,原价 ¥18000。全年所有课程免费参加,探索活动优先参与,社群互助无限次。',
}

export default function PricingPage() {
  return <PricingContent />
}
