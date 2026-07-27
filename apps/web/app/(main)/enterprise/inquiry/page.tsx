import type { Metadata } from 'next'
import { InquiryContent } from './InquiryContent'

export const metadata: Metadata = {
  title: '企业询价 - IHUI AI 专业服务',
  description:
    '提交企业询价表单,我们的销售顾问将在 24 小时内联系您。私有化部署、企业培训、定制开发、技术咨询。',
  openGraph: {
    title: '企业询价 - IHUI AI',
    description: '专属顾问 1 对 1 服务,帮您匹配最佳 AI 解决方案。',
  },
}

export default function EnterpriseInquiryPage() {
  return <InquiryContent />
}
