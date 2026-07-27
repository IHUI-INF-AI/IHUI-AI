import type { Metadata } from 'next'
import { ProductsContent } from './ProductsContent'

export const metadata: Metadata = {
  title: '数字产品 - AI 提示词库/Agent模板/部署指南/认证课程',
  description:
    'IHUI AI 数字产品商店：200+ prompts、企业 Agent 模板、部署指南、源码包、AI 工程师认证、定制开发服务。',
  alternates: {
    canonical: '/products',
  },
  openGraph: {
    title: '数字产品 — IHUI AI',
    description:
      '200+ AI 提示词、企业 Agent 模板、部署指南、源码包、AI 工程师认证课程、定制 Agent 开发服务。',
    url: 'https://ihui.ai/products',
    type: 'website',
  },
}

export default function ProductsPage() {
  return <ProductsContent />
}
