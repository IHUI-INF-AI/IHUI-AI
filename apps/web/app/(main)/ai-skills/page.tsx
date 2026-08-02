import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'AI Skills — 智能 Agent 技能库 | 智汇 AI',
  description:
    '智汇 AI Skills:智能 Agent 技能库,预置 100+ 常用技能模板。一键安装到你的 Agent,扩展搜索、代码执行、数据处理、API 调用等能力。',
  alternates: { canonical: '/ai-skills' },
  openGraph: {
    title: 'AI Skills — 智能 Agent 技能库',
    description: '100+ 预置技能模板,一键安装扩展 Agent 能力',
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
