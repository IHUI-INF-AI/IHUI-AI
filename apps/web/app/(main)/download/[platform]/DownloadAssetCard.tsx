// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { Cpu, Download, HardDrive } from 'lucide-react'

import { cn } from '@/lib/utils'
import { assetNameFromHref, isSafeAssetName } from '@/lib/desktop-download-leg'
import { Card } from '@ihui/ui-react'
import {
  formatFileSize,
  type DownloadAsset,
  type DownloadPlatform,
} from '@/config/downloads.config'
import { useDownloadTrack } from '@ihui/shared/hooks'

/** 单个下载资源卡片(format / arch / size + 下载按钮) */
export function DownloadAssetCard({
  asset,
  label,
  t,
  platform,
}: {
  asset: DownloadAsset
  label: string
  t: (key: string) => string
  platform: DownloadPlatform
}) {
  const trackDownload = useDownloadTrack()
  const isExternal = /^https?:/.test(asset.href)
  // 桌面端的一击交同源解析器 `/dl/desktop`(按访客地域 302:国内且字节等值⇒Gitee,其余⇒GitHub 权威腿)。
  // 判据全在服务端那一份(`lib/desktop-download-leg.ts` + `config/desktop-feed-live.ts`),这里只负责
  // "文件名不合法 / 不是桌面端 ⇒ 原样直链",不在前端猜第二条腿,也不给小程序/RN 那两端换语义。
  const assetName = platform === 'desktop' ? assetNameFromHref(asset.href) : ''
  const legHref = /^https?:/.test(asset.href) && assetName && isSafeAssetName(assetName)
    ? `/dl/desktop?file=${encodeURIComponent(assetName)}`
    : asset.href
  const sizeLabel = formatFileSize(asset.sizeBytes)

  return (
    <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cta/10 text-primary">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{asset.format}</span>
            {asset.arch && (
              <span className="inline-flex items-center gap-0.5 rounded-sm bg-muted px-1 py-px text-[10px] text-muted-foreground">
                <Cpu className="h-2.5 w-2.5" />
                {asset.arch}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-label text-muted-foreground">
            <span className="inline-flex items-center gap-0.5">
              <HardDrive className="h-2.5 w-2.5" />
              {sizeLabel}
            </span>
            {asset.sha256 && <span className="font-mono">SHA256: {asset.sha256.slice(0, 8)}…</span>}
          </div>
        </div>
      </div>
      <a
        href={legHref}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        onClick={() => trackDownload(platform, 'detail_page', asset.href)}
        className={cn(
          'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-cta px-4 text-body font-medium text-cta-foreground transition-colors hover:bg-cta/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      >
        <Download className="h-4 w-4" />
        <span>{t('downloadNow')}</span>
        <span className="sr-only">— {label}</span>
      </a>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
