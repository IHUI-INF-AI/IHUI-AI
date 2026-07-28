import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ServicesContent } from './ServicesContent'
import { InquiryForm } from './InquiryForm'

export const metadata: Metadata = {
  title: '专业服务 - 私有化部署/培训/定制开发/咨询',
  description:
    'IHUI AI 团队提供 4 类企业级服务:私有化部署 ¥4,999、企业培训 ¥9,999、定制开发 ¥19,999 起、技术咨询 ¥999/小时。从部署到定制,全栈 AI 解决方案。',
  openGraph: {
    title: 'IHUI AI 专业服务',
    description: '私有化部署 / 企业培训 / 定制开发 / 技术咨询,直接产生现金流的企业级服务。',
  },
}

export default function ServicesPage() {
  return (
    <>
      <ServicesContent />
      <section className="mx-auto w-full max-w-2xl px-4 pb-6 md:px-8">
        <Suspense fallback={null}>
          <InquiryForm />
        </Suspense>
      </section>
    </>
  )
}
