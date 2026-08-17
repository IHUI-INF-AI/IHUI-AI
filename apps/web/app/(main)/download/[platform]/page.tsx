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

// Next.js 16.2.12 动态路由 page 组件(server component,仅 params 解析 + 渲染 client content)
// 2026-08-17 修复:generateStaticParams 原仅返回 desktop,导致静态导出(out/)
// 缺 android-apk 等平台下载页(线上 /download/android-apk 会 404 或走占位)。
// 现返回全部 8 端,静态导出将生成各平台独立 HTML,客户端运行时再按 env 渲染。
export function generateStaticParams() {
  return [
    { platform: 'web' },
    { platform: 'desktop' },
    { platform: 'ios' },
    { platform: 'android-apk' },
    { platform: 'mobile' },
    { platform: 'wechat-miniapp' },
    { platform: 'extension' },
    { platform: 'cli' },
  ]
}

export default async function DownloadPage({ params }: DownloadPageProps) {
  const { platform } = await params
  return <DownloadDetailContent platform={platform} />
}
