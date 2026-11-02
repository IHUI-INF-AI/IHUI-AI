// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /download/[platform] 的服务端入口。
 *
 * 2026-11-02:这一层现在是「运行期真值」的唯一装配点 —— 解析与合并都只在这里发生一次
 * (判据单源 = @/config/downloads-live),client 组件只收已合并好的元数据。放在服务端
 * 有两层理由:
 *  1. 扩展端要枚举实物文件算体积/版本(`node:fs`),不能进浏览器包;
 *  2. 合并判据只住一处 —— 此前详情页按端写 if,漏掉的端结构上永远拿不到运行期值。
 *
 * 窗口:与 desktop-feed 同一 ISR 窗口(10 分钟),CDN 侧 s-maxage=600 + SWR=3600
 * 见 @/config/public-html-cache。GitHub 未认证上限 60 次/小时/IP,desktop 与 iOS 两条腿
 * 各占 6 次/小时 —— 要缩短窗口先确认限流余量,别把"取不到 ⇒ 降级成 snapshot"调成常态。
 */
import type { Metadata } from 'next'
import { DownloadDetailContent } from './DownloadDetailContent'
import {
  DOWNLOAD_PLATFORMS,
  getPlatformMeta,
  isDownloadPlatform,
} from '@/config/downloads.config'
import { mergeLiveMeta } from '@/config/downloads-live-meta'
import { resolveLiveDownload } from '@/config/downloads-live'

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

// Next.js 16.2.12 动态路由 page 组件(server component,仅参数归一 + 运行期装配 + 渲染 client content)
// 2026-08-17 修复:generateStaticParams 原仅返回 desktop,导致静态导出(out/)
// 缺 android-apk 等平台下载页(线上 /download/android-apk 会 404 或走占位)。
// 2026-11-02:清单改取 DOWNLOAD_PLATFORMS 单源 —— 此前这里手抄一份 8 端数组,加一端要改两处。
// 现返回全部 8 端,静态导出将生成各平台独立 HTML,客户端运行时再按 env 渲染。
// 2026-11-03:清单不再在此手抄第二份 —— 直接 map DOWNLOAD_PLATFORMS 唯一来源;
// 未登记的端(如 /download/harmony)渲染成显式「尚未上线」态,不回落 desktop。
export function generateStaticParams() {
  return DOWNLOAD_PLATFORMS.map((platform) => ({ platform }))
}

export const revalidate = 600

export default async function DownloadPage({ params }: DownloadPageProps) {
  const { platform: rawPlatform } = await params
  // 认不出的平台段直接把原串交给 client 走显式「尚未上线」态:不回落 desktop
  // (2026-11-03 收口),也没有可解析的上游 —— 不白跑一次运行期解析。
  if (!isDownloadPlatform(rawPlatform)) {
    return <DownloadDetailContent platform={rawPlatform} />
  }
  // 只解析被请求的那一端:其余端的上游开销不应摊到这次渲染上
  const live = await resolveLiveDownload(rawPlatform)
  const meta = mergeLiveMeta(getPlatformMeta(rawPlatform), live)
  return <DownloadDetailContent platform={rawPlatform} meta={meta} />
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
