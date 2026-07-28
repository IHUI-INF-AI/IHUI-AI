import type { Metadata } from 'next'
import { PricingContent } from './PricingContent'

export const metadata: Metadata = {
  title: 'API 定价',
  description:
    'IHUI AI 开放平台 API 定价:按 token 用量计费,input/output 分开结算,提供 176+ 模型价格表、按量计费规则说明与 cURL/Node.js/Python 调用示例。',
}

export default function DeveloperPricingPage() {
  return <PricingContent />
}
