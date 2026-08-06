import type { Metadata } from 'next'
import { DownloadDetailContent } from './DownloadDetailContent'

interface DownloadPageProps {
  params: Promise<{ platform: string }>
}

// 静态 metadata(动态 platform 在 DownloadDetailContent 内通过 useTranslations 设置 page title)
export const metadata: Metadata = {
  title: '下载客户端 — IHUI AI',
  description:
    'IHUI AI 全平台客户端下载:Web / Desktop(Windows) / 浏览器扩展 / CLI / iOS / Android / 微信小程序,8 端同源,选择适合你的平台。',
  alternates: {
    canonical: '/download/desktop',
    languages: {
      'x-default': '/download/desktop',
      en: '/en/download/desktop',
    },
  },
}

// Next.js 15 动态路由 page 组件(server component,仅 params 解析 + 渲染 client content)
export default async function DownloadPage({ params }: DownloadPageProps) {
  const { platform } = await params
  return <DownloadDetailContent platform={platform} />
}
