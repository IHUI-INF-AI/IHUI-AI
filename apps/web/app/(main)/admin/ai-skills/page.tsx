import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'AI Skill 统计 | 管理后台 | 智汇 AI',
  description: 'AI Skill 使用统计、成功率、趋势分析。',
  alternates: { canonical: '/admin/ai-skills' },
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageClient />
    </Suspense>
  )
}