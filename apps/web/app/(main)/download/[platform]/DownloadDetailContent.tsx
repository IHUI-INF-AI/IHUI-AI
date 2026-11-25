// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, ChevronRight, ExternalLink, Globe, Package, ShieldAlert } from 'lucide-react'

import { Button, Card } from '@ihui/ui-react'
import {
  getPlatformMeta,
  isDownloadPlatform,
  isPlatformLaunched,
  type DownloadPlatform,
  type PlatformMeta,
} from '@/config/downloads.config'
import { DOWNLOAD_ENTRY_BY_PLATFORM } from './platformEntries'
import { PlatformNotLaunched } from './PlatformNotLaunched'
import { DownloadDetailHeader } from '@/components/download/DownloadDetailHeader'
import { DownloadAssetCard } from '@/components/download/DownloadAssetCard'
import { InstallGuideContent } from '@/components/download/InstallGuideContent'
import { WindowsFirstRunGuide } from '@/components/download/WindowsFirstRunGuide'

/**
 * 详情页主内容(client component,使用 useTranslations + useParams)
 *
 * 2026-11-02 收口:`meta` 由 server page 传入,且已按「构建期底稿 ⊕ 运行期真值」合并完
 * (合并判据单源 = @/config/downloads-live 的 `mergeLiveMeta`)。
 * 此前这里按端各写一个 if 分支 —— 只有 desktop / android-apk 有分支,其余 6 端**结构上**
 * 拿不到运行期值,于是"包已发出去、页面还写旧号"对它们长期成立。合并挪到服务端还顺带
 * 保证客户端包里不出现 `node:fs`(扩展端要枚举实物文件)。
 *
 * 2026-11-03:拆出 DownloadDetailHeader / DownloadAssetCard / InstallGuideContent 三个展示组件
 * (本文件此前 442 行,超出本仓"每页面 < 250 行"的约束)。
 * 2026-11-04:三者移到 `@/components/download/` —— 105a55a4 把它们当"零消费"删掉时本文件仍
 * import 它们(漏改),远端主干因此编译不过;移出 `[platform]` 目录后该删除不再命中它们。
 * 同一批把认不出的平台段
 * 从"静默回落 desktop"改成显式 PlatformNotLaunched 态。
 */
export function DownloadDetailContent({
  platform: platformParam,
  meta: mergedMeta,
}: {
  platform: string
  /** server page 已合并好的元数据;未传(测试/直调)时回落到构建期快照 */
  meta?: PlatformMeta | null
}) {
  const t = useTranslations('nav')
  const router = useRouter()

  // 认不出的平台段 ⇒ 显式「该平台尚未上线」态。
  // 旧写法是 `validPlatforms.includes(x) ? x : 'desktop'` —— 把 /download/harmony 这类
  // "平台确实存在、只是下载中心还没上"的 URL 静默折成桌面版,用户看到的就是桌面版详情页。
  // 清单的唯一来源已是 DOWNLOAD_PLATFORMS(见 @/config/downloads.config),此处只做判定。
  if (!isDownloadPlatform(platformParam)) {
    return <PlatformNotLaunched platformParam={platformParam} />
  }
  const platform: DownloadPlatform = platformParam

  // 2026-11-02 收口:运行期真值已在 server page 合并完(判据单源 = @/config/downloads-live 的 mergeLiveMeta),
  // 客户端只收已合并好的元数据 —— 此前这里按端各写 if 分支,其余 6 端结构上拿不到运行期值。
  // 未传 meta(测试/直调)时回落到构建期快照,详情页形态不变。
  const meta: PlatformMeta = mergedMeta ?? getPlatformMeta(platform)
  // 图标与名称取自 DOWNLOADS 同一张表(此前此处另有 PLATFORM_ICON / PLATFORM_LABEL_KEY
  // 两张同义副本,新增一端要改三处才能不静默错配)
  const entry = DOWNLOAD_ENTRY_BY_PLATFORM[platform]
  const label = t(entry.labelKey)
  const hasAssets = meta.assets.length > 0
  // 「已发布」徽章的判据与「尚未上线」态的可选平台清单同源(见 isPlatformLaunched)
  const isAvailable = isPlatformLaunched(meta)

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-4">
      {/* 返回按钮 */}
      {/* back-label-exempt: 详情页的「返回」是带矢量箭头的按钮文案(ArrowLeft 已在同一按钮内),不是把两个字当箭头 until 2026-12-31 */}
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-body text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:outline-none"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{t('downloadBack')}</span>
      </button>

      {/* 头部卡片:平台图标 + 名称 + 版本 + 发布日期 + 状态徽章 */}
      <DownloadDetailHeader
        icon={entry.icon}
        label={label}
        meta={meta}
        isAvailable={isAvailable}
        t={t}
      />

      {/* 主区域:基于 assets 状态分支渲染 */}
      {hasAssets ? (
        // 已接入:显示下载资源列表
        <section className="mb-6">
          <h2 className="mb-3 text-body font-semibold uppercase tracking-wider text-muted-foreground/70">
            {t('downloadAssets')}
          </h2>
          {/* 下载前的预告:Windows 用户点开安装包前就知道会看到 SmartScreen,不被"未知发布者"吓退 */}
          {platform === 'desktop' && (
            <a
              href="#windows-first-run"
              className="mb-3 flex items-start gap-2 rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2.5 transition-colors hover:bg-sky-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus"
            >
              <ShieldAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 text-label leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">{t('downloadWinNoticeLead')}</span>
                {t('downloadWinNotice')}
              </span>
              <span className="hidden shrink-0 items-center gap-0.5 text-label font-medium text-sky-700 tablet:inline-flex dark:text-sky-300">
                {t('downloadWinNoticeCta')}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </a>
          )}
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
      ) : isAvailable ? null : (
        // 未接入:显示"即将上线"占位 + Web 端使用引导
        // 注意:assets 为空 ≠ 未上架。CLI(走 npm)与 Mobile(走源码构建)都没有独立
        // 安装包,但 version + installGuideKey 齐全 ⇒ isAvailable=true,下方安装指南
        // 已是完整入口。此处再插一张"即将上线"卡片会自相矛盾(头部却显示"可用")。
        <section className="mb-6">
          <Card className="border-dashed bg-muted/30 p-3 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <h2 className="mb-1 text-base font-medium text-foreground">
              {/* 该 key 的取值带 {platform} 占位(五语言同形),此前漏传 vars ⇒ 占位符裸奔 */}
              {t('downloadComingSoonTitle', { platform: label })}
            </h2>
            <p className="mx-auto max-w-md text-body text-muted-foreground">
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

      {/* Windows 首次运行引导:安装包未签 Authenticode,SmartScreen 必弹;程序层无法隐藏,
          只能在下载页提前讲清"更多信息 → 仍要运行"。仅桌面端需要,CLI 走 npm 不涉及 exe。 */}
      {platform === 'desktop' && <WindowsFirstRunGuide t={t} />}

      {/* 安装指南(CLI 显示 npm 命令 / Mobile 显示构建说明 / 其他显示通用步骤) */}
      {meta.installGuideKey && (
        <section className="mb-6">
          <h2 className="mb-3 text-body font-semibold uppercase tracking-wider text-muted-foreground/70">
            {t('downloadInstallGuide')}
          </h2>
          <Card className="p-3">
            <InstallGuideContent platform={platform} t={t} guideKey={meta.installGuideKey} />
          </Card>
        </section>
      )}

      {/* 系统要求 */}
      {meta.systemRequirementsKey && (
        <section className="mb-6">
          <h2 className="mb-3 text-body font-semibold uppercase tracking-wider text-muted-foreground/70">
            {t('downloadSystemRequirements')}
          </h2>
          <Card className="p-3">
            <p className="whitespace-pre-line text-body text-muted-foreground">
              {t(meta.systemRequirementsKey)}
            </p>
          </Card>
        </section>
      )}

      {/* 底部链接区:GitHub Releases + Docs */}
      {(meta.githubReleasesUrl || meta.docsUrl) && (
        <section className="flex flex-wrap gap-3 pt-4">
          {meta.githubReleasesUrl && (
            <a
              href={meta.githubReleasesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-body text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-body text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
