import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'AI Skills — 智能 Agent 技能库 | 智汇 AI',
  description:
    '智汇 AI Skills:智能 Agent 技能库,预置 25+ 常用技能模板,覆盖代码审查、测试生成、自媒体文案、PPT 大纲等场景。一键调用,扩展 Agent 能力。',
  alternates: { canonical: '/ai-skills' },
  openGraph: {
    title: 'AI Skills — 智能 Agent 技能库',
    description: '25+ 预置技能模板,一键调用扩展 Agent 能力',
    url: 'https://aizhs.top/ai-skills',
    type: 'website',
  },
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageClient />
    </Suspense>
  )
}
