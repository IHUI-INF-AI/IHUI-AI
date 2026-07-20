'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Mail } from 'lucide-react'
import {
  DATABASES,
  IMG_EAGER,
  MODELS,
  PAYMENTS,
  PROMOTIONS,
  QRS,
  SUPPORTED,
  type Icon,
  type Qr,
} from './footer-data'

/**
 * SiteFooter — 公司信息 + 生态平台 + 推广平台 + 二维码 + 协议
 *
 * 布局:3 栏 grid(md+)
 *   1. 公司信息(名称/地址/电话/邮箱) + 6 快速链接
 *   2. 4 类生态平台 Logo(支持 2 / 模型 8 / 支付 5 / 数据库 5)
 *   3. 官方推广平台 16 槽位 + 1 官方应用 QR + 1 联系卡片
 * 底部:ICP 备案 + 版权 + 协议链接
 *
 * 图片数据集中在 `footer-data.ts`,与 BrandMarquee 共享单一来源。
 * i18n 全部走 `footer.*` / `routes.*`,5 语言已 parity。
 *
 * 2026-07-20 修复:
 * - ICON_BOX 背景从 bg-white 改 bg-foreground/[0.04],让 model/3x(Claude 白底透明)
 *   + awsp/n8n(白底透明)+ tuiguangpingtai/3/5/11(白底透明)等图标在白卡上可见。
 * - QR_BOX 改 bg-zinc-900(始终深色),让 footer-icon-2.png 的白色 QR 码在亮/暗模式都可见。
 * - footer-icon-3.png 是 2534×2534 全空白色块(无 QR 数据),改用 Mail 图标 + 联系卡片。
 */

type Link_ = { readonly labelKey: string; readonly href: string }

const QUICK_LINKS: readonly Link_[] = [
  { labelKey: 'about', href: '/about' },
  { labelKey: 'help', href: '/help' },
  { labelKey: 'feedback', href: '/feedback' },
  { labelKey: 'privacyPolicy', href: '/agreement/privacy' },
  { labelKey: 'termsOfService', href: '/agreement/terms' },
  { labelKey: 'userAgreement', href: '/agreement' },
]

// 排版原子 — 集中定义,避免散落
const SECTION_TITLE = 'text-xs font-semibold text-foreground/80'
// 2026-07-20 改:bg-foreground/[0.04] 替代 bg-white,让白底透明 PNG 图标在白卡上可见
const ICON_BOX =
  'flex h-9 w-9 items-center justify-center rounded-md border bg-foreground/[0.04] transition-colors hover:border-primary/40'
const ICON_IMG = 'h-6 w-6 object-contain'
// 2026-07-20 改:bg-zinc-900 始终深色,让 footer-icon-2.png 白色 QR 码在亮/暗模式都可见
const QR_BOX = 'h-24 w-24 overflow-hidden rounded-md border border-zinc-900 bg-zinc-900 p-1.5'
const QR_IMG = 'h-full w-full object-contain'
const COMPANY_LINK = 'text-muted-foreground transition-colors hover:text-primary'
const FOOTER_BOTTOM_LINK = 'transition-colors hover:text-primary'
// 2026-07-20 新增:联系卡片容器(替代空白 footer-icon-3.png)
const CONTACT_CARD =
  'flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-md border bg-foreground/[0.04] transition-colors hover:border-primary/40'

function PlatformIcon({ name, src, href }: { name: string; src: string; href?: string }) {
  const img = (
    <img src={src} alt={name} width={24} height={24} className={ICON_IMG} {...IMG_EAGER} />
  )
  const className = ICON_BOX
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={name} className={className}>
        {img}
      </a>
    )
  }
  return (
    <div title={name} className={className}>
      {img}
    </div>
  )
}

function PlatformGroup({
  title,
  items,
  t,
}: {
  title: string
  items: readonly Icon[]
  t: ReturnType<typeof useTranslations<'footer'>>
}) {
  return (
    <div className="space-y-1.5">
      <h4 className={SECTION_TITLE}>{title}</h4>
      <div className="flex flex-wrap gap-2">
        {items.map((p) => (
          <PlatformIcon
            key={p.nameKey}
            name={t(p.nameKey)}
            src={p.src}
            {...(p.href ? { href: p.href } : {})}
          />
        ))}
      </div>
    </div>
  )
}

function QrItem({ qr, t }: { qr: Qr; t: ReturnType<typeof useTranslations<'footer'>> }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={QR_BOX}>
        <img
          src={qr.src}
          alt={t(qr.altKey)}
          width={88}
          height={88}
          className={QR_IMG}
          {...IMG_EAGER}
        />
      </div>
      <span className="text-xs text-muted-foreground">{t(qr.altKey)}</span>
    </div>
  )
}

export function SiteFooter() {
  const t = useTranslations('footer')
  const tRoutes = useTranslations('routes')

  return (
    <footer className="mt-12 border-t bg-card/50">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* 公司信息 + 快速链接 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{t('companyName')}</h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>
                <span className="font-medium text-foreground/70">{t('addressLabel')}</span>
                {t('addressLine1')}
              </li>
              <li className="pl-[3.5em]">{t('addressLine2')}</li>
              <li>{t('companyContact')}</li>
              <li>{t('companyEmail')}</li>
              <li className="pl-[3.5em]">{t('companyEmail2')}</li>
            </ul>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs">
              {QUICK_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className={COMPANY_LINK}>
                  {tRoutes(l.labelKey)}
                </Link>
              ))}
            </div>
          </div>

          {/* 4 类生态平台 */}
          <div className="space-y-3">
            <PlatformGroup title={t('supportedPlatforms')} items={SUPPORTED} t={t} />
            <PlatformGroup title={t('models')} items={MODELS} t={t} />
            <PlatformGroup title={t('paymentPlatforms')} items={PAYMENTS} t={t} />
            <PlatformGroup title={t('cloudDatabases')} items={DATABASES} t={t} />
          </div>

          {/* 推广平台 + 二维码 + 联系卡片 */}
          <div className="space-y-3">
            <PlatformGroup title={t('officialPromotion')} items={PROMOTIONS} t={t} />
            <div className="flex gap-5 pt-2">
              {QRS.map((q) => (
                <QrItem key={q.src} qr={q} t={t} />
              ))}
              {/* 联系卡片(替代空白色块 footer-icon-3.png) */}
              <div className="flex flex-col items-center gap-1.5">
                <Link href="/support" className={CONTACT_CARD} title={t('contactUs')}>
                  <Mail className="h-7 w-7 text-foreground/70" aria-hidden="true" />
                </Link>
                <span className="text-xs text-muted-foreground">{t('contactUs')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 底部:ICP + 版权 + 协议 */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <img
              src="/footer/erweima/footer-icon-1.png"
              alt={t('icp')}
              width={16}
              height={16}
              className="h-4 w-4 object-contain"
              {...IMG_EAGER}
            />
            <span>{t('icp')}</span>
            <span className="mx-1">·</span>
            <span>{t('copyright')}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/agreement" className={FOOTER_BOTTOM_LINK}>
              {tRoutes('userAgreement')}
            </Link>
            <Link href="/agreement/privacy" className={FOOTER_BOTTOM_LINK}>
              {tRoutes('privacyPolicy')}
            </Link>
            <Link href="/support" className={FOOTER_BOTTOM_LINK}>
              {t('contactUs')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
