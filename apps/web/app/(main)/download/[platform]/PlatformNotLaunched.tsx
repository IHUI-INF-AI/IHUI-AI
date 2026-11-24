// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Globe, Package } from 'lucide-react'

import { Button, Card } from '@ihui/ui-react'
import { getLaunchedPlatforms } from '@/config/downloads.config'
import { platformEntriesOf } from './platformEntries'

/**
 * 「该平台尚未上线」显式态(URL 平台段不在下载中心清单里时)。
 *
 * 修的是静默错配:此前 `/download/[platform]` 把认不出的平台段悄悄折成 desktop,
 * 访问 `/download/harmony`(harmony 已在 apps/api 的 app-version 枚举里,下载中心未上)
 * 会渲染成桌面版详情页,用户以为那就是鸿蒙版;任何未来新增的平台都会复发。
 * 现在认不出就明说,并把「当前能走哪几端」摊在同一个页面里。
 *
 * 视觉语言沿用该页既有的「即将上线」卡(dashed Card + Package 素材 + 「使用 Web 版」入口),
 * 不另起第二套;差别只在文案 —— 未知平台 ≠ 正在开发的平台,不能对用户许诺"开发中"。
 * 返回键不在这里重复实现:页面唯一的返回实现归顶栏(守门 46),本组件只给前进入口。
 */

/** URL 里的平台段是用户可控文本:只回显安全字符并截到 24;一个字也没剩就用 'URL' 兜底 */
function sanitizePlatformParam(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 24)
  return cleaned.length > 0 ? cleaned : 'URL'
}

export function PlatformNotLaunched({ platformParam }: { platformParam: string }) {
  const t = useTranslations('nav')
  const token = sanitizePlatformParam(platformParam)
  const launched = platformEntriesOf(getLaunchedPlatforms())

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-4" data-platform-state="not-launched">
      <Card className="mb-6 border-dashed bg-muted/30 p-3 text-center">
        <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <h1 className="mb-1 text-base font-medium text-foreground">
          {t('downloadNotLaunchedTitle', { platform: token })}
        </h1>
        <p className="mx-auto max-w-md text-body text-muted-foreground">
          {t('downloadNotLaunchedHint', { platform: token })}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Link href="/">
            <Button variant="default" size="sm">
              <Globe className="mr-1.5 h-3.5 w-3.5" />
              {t('downloadUseWeb')}
            </Button>
          </Link>
        </div>
      </Card>

      <section>
        <h2 className="mb-3 text-body font-semibold uppercase tracking-wider text-muted-foreground/70">
          {t('downloadAvailablePlatforms')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {launched.map((entry) => {
            const Icon = entry.icon
            return (
              <Link
                key={entry.platform}
                href={`/download/${entry.platform}`}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-body text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:outline-none"
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t(entry.labelKey)}</span>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
