import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'AI 内容生成 — 文本 / 图像 / 视频 / 音乐 / 3D | 智汇 AI',
  description:
    '智汇 AI 内容生成:一键生成文本、图像、视频、音乐、3D 模型。集成 DALL-E / Stable Diffusion / Sora / Suno 等顶级生成模型,支持多模态混合创作。',
  alternates: { canonical: '/ai-generation' },
  openGraph: {
    title: 'AI 内容生成 — 文本 / 图像 / 视频 / 音乐 / 3D',
    description: '多模态 AI 创作平台,集成 DALL-E / SD / Sora / Suno',
    url: 'https://aizhs.top/ai-generation',
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
