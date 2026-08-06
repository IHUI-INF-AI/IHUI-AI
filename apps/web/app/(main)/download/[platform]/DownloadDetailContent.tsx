'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Globe,
  Monitor,
  Puzzle,
  Smartphone,
  Terminal,
  Package,
  Calendar,
  Cpu,
  HardDrive,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button, Card } from '@ihui/ui-react'
import {
  AppleIcon,
  AndroidIcon,
  WechatMiniIcon,
} from '@/lib/downloads'
import {
  formatFileSize,
  getPlatformMeta,
  type DownloadAsset,
  type DownloadPlatform,
  type PlatformMeta,
} from '@/config/downloads.config'
import { useDownloadTrack } from '@ihui/shared/hooks'

/** platform → 图标组件映射(与 downloads.tsx 的 DOWNLOADS 数组同源) */
const PLATFORM_ICON: Record<DownloadPlatform, LucideIcon | React.FC<{ className?: string }>> = {
  web: Globe,
  desktop: Monitor,
  ios: AppleIcon,
  'android-apk': AndroidIcon,
  mobile: Smartphone,
  'wechat-miniapp': WechatMiniIcon,
  extension: Puzzle,
  cli: Terminal,
}

/** platform → labelKey 映射(用于 t() 翻译) */
const PLATFORM_LABEL_KEY: Record<DownloadPlatform, string> = {
  web: 'downloadWeb',
  desktop: 'downloadDesktop',
  ios: 'downloadIOS',
  'android-apk': 'downloadAndroidApk',
  mobile: 'downloadMobile',
  'wechat-miniapp': 'downloadWechatMiniApp',
  extension: 'downloadExtension',
  cli: 'downloadCli',
}

/** 详情页主内容(client component,使用 useTranslations + useParams) */
export function DownloadDetailContent({ platform: platformParam }: { platform: string }) {
  const t = useTranslations('nav')
  const router = useRouter()

  // 校验 platform 参数,无效则回退到 desktop
  const validPlatforms: DownloadPlatform[] = [
    'web',
    'desktop',
    'ios',
    'android-apk',
    'mobile',
    'wechat-miniapp',
    'extension',
    'cli',
  ]
  const platform = (
    validPlatforms.includes(platformParam as DownloadPlatform)
      ? platformParam
      : 'desktop'
  ) as DownloadPlatform

  const meta: PlatformMeta = getPlatformMeta(platform)
  const Icon = PLATFORM_ICON[platform]
  const label = t(PLATFORM_LABEL_KEY[platform])
  const hasAssets = meta.assets.length > 0
  const isAvailable = hasAssets || (meta.version && meta.installGuideKey) ? true : false

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      {/* 返回按钮 */}
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:outline-none"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{t('downloadBack')}</span>
      </button>

      {/* 头部卡片:平台图标 + 名称 + 版本 + 发布日期 + 状态徽章 */}
      <Card className="mb-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
                <span>{label}</span>
                {meta.version && (
                  <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                    v{meta.version}
                  </span>
                )}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {meta.releaseDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {meta.releaseDate}
                  </span>
                )}
                {isAvailable ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    {t('downloadAvailable')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <Package className="h-3 w-3" />
                    {t('downloadComingSoon')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 主区域:基于 assets 状态分支渲染 */}
      {hasAssets ? (
        // 已接入:显示下载资源列表
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
            {t('downloadAssets')}
          </h2>
          <div className="grid gap-3">
            {meta.assets.map((asset, idx) => (
              <DownloadAssetCard
                key={`${asset.href}-${idx}`}
                asset={asset}
                label={label}
                t={t}
                platform={platform}
              />
            ))}
          </div>
        </section>
      ) : (
        // 未接入:显示"即将上线"占位 + Web 端使用引导
        <section className="mb-6">
          <Card className="border-dashed bg-muted/30 p-8 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <h2 className="mb-1 text-base font-medium text-foreground">
              {t('downloadComingSoonTitle')}
            </h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {t('downloadComingSoonHint', { platform: label })}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Link href="/">
                <Button variant="default" size="sm">
                  <Globe className="mr-1.5 h-3.5 w-3.5" />
                  {t('downloadUseWeb')}
                </Button>
              </Link>
              {meta.githubReleasesUrl && (
                <a href={meta.githubReleasesUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    GitHub
                  </Button>
                </a>
              )}
            </div>
          </Card>
        </section>
      )}

      {/* 安装指南(CLI 显示 npm 命令 / Mobile 显示构建说明 / 其他显示通用步骤) */}
      {meta.installGuideKey && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
            {t('downloadInstallGuide')}
          </h2>
          <Card className="p-4">
            <InstallGuideContent platform={platform} t={t} guideKey={meta.installGuideKey} />
          </Card>
        </section>
      )}

      {/* 系统要求 */}
      {meta.systemRequirementsKey && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
            {t('downloadSystemRequirements')}
          </h2>
          <Card className="p-4">
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {t(meta.systemRequirementsKey)}
            </p>
          </Card>
        </section>
      )}

      {/* 底部链接区:GitHub Releases + Docs */}
      {(meta.githubReleasesUrl || meta.docsUrl) && (
        <section className="flex flex-wrap gap-3 border-t border-border pt-4">
          {meta.githubReleasesUrl && (
            <a
              href={meta.githubReleasesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('downloadGithubReleases')}
            </a>
          )}
          {meta.docsUrl && (
            <a
              href={meta.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('downloadDocs')}
            </a>
          )}
        </section>
      )}
    </div>
  )
}

/** 单个下载资源卡片(format / arch / size + 下载按钮) */
function DownloadAssetCard({
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
  const sizeLabel = formatFileSize(asset.sizeBytes)

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
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
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-0.5">
              <HardDrive className="h-2.5 w-2.5" />
              {sizeLabel}
            </span>
            {asset.sha256 && (
              <span className="font-mono">SHA256: {asset.sha256.slice(0, 8)}…</span>
            )}
          </div>
        </div>
      </div>
      <a
        href={asset.href}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        onClick={() => trackDownload(platform, 'detail_page', asset.href)}
        className={cn(
          'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      >
        <Download className="h-4 w-4" />
        <span>{t('downloadNow')}</span>
        <span className="sr-only">— {label}</span>
      </a>
    </Card>
  )
}

/**
 * 安装指南内容(基于 platform 渲染不同形式):
 *  - cli:显示 npm install 命令(可复制)
 *  - extension:显示加载步骤 + 命令
 *  - 其他:显示纯文本指南
 */
function InstallGuideContent({
  platform,
  t,
  guideKey,
}: {
  platform: DownloadPlatform
  t: (key: string) => string
  guideKey: string
}) {
  const guideText = t(guideKey)
  // 2026-08-06 修复:copied state 从 cli 分支内提升到组件顶层——原实现
  // `if (platform === 'cli')` 块内调用 useState,违反 Rules of Hooks(条件 Hook),
  // 平台切换时 Hook 顺序变化会导致 React 运行时崩溃。
  const [copied, setCopied] = React.useState(false)

  // CLI:渲染 npm 命令块(可复制)
  if (platform === 'cli') {
    const handleCopy = () => {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard.writeText('npm install -g @ihui/cli')
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    }
    return (
      <div className="space-y-3">
        <p className="whitespace-pre-line text-sm text-muted-foreground">{guideText}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-sm text-foreground">
            npm install -g @ihui/cli
          </code>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? t('downloadCopied') : t('downloadCopy')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('downloadCliUsageHint')} <code className="font-mono">ihui --help</code>
        </p>
      </div>
    )
  }

  // Extension:渲染加载步骤 + 命令
  if (platform === 'extension') {
    return (
      <div className="space-y-3">
        <p className="whitespace-pre-line text-sm text-muted-foreground">{guideText}</p>
        <ol className="ml-4 list-decimal space-y-1 text-sm text-muted-foreground">
          <li>{t('downloadExtensionStep1')}</li>
          <li>{t('downloadExtensionStep2')}</li>
          <li>{t('downloadExtensionStep3')}</li>
          <li>{t('downloadExtensionStep4')}</li>
        </ol>
      </div>
    )
  }

  // 其他:纯文本
  return <p className="whitespace-pre-line text-sm text-muted-foreground">{guideText}</p>
}
