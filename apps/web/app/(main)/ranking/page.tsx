import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: '排行榜 — Agent / 作者 / 贡献者排名 | 智汇 AI',
  description:
    '智汇 AI 排行榜:Agent 热度榜、作者贡献榜、社区活跃榜。发现优质 AI Agent 与创作者,了解平台最新趋势。',
  alternates: { canonical: '/ranking' },
  openGraph: {
    title: '排行榜 — Agent / 作者 / 贡献者排名',
    description: '发现优质 AI Agent 与创作者',
    url: 'https://aizhs.top/ranking',
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
