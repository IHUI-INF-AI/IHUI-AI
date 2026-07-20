'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

/**
 * SiteFooter — 公司信息 + 生态平台 + 推广平台 + 二维码 + 协议
 *
 * 布局:3 栏 grid(md+)
 *   1. 公司信息(名称/地址/电话/邮箱) + 6 快速链接
 *   2. 4 类生态平台 Logo(支持 2 / 模型 8 / 支付 5 / 数据库 5)
 *   3. 官方推广平台 16 槽位 + 2 固定二维码
 * 底部:ICP 备案 + 版权 + 协议链接
 *
 * i18n:全部文案走 `footer.*` / `routes.*`,5 语言已 parity。
 * 资源:public/footer/ 路径,Next.js Image unoptimized 直出。
 */
type Icon = { readonly nameKey: string; readonly src: string; readonly href?: string }
type Link_ = { readonly labelKey: string; readonly href: string }
type Qr = { readonly src: string; readonly altKey: 'officialApp' | 'contactUs' }

const ICON_BOX =
  'flex h-9 w-9 items-center justify-center rounded-md border bg-white transition-colors hover:border-primary/40'
const ICON_IMG = 'h-6 w-6 object-contain'
const QR_BOX = 'h-24 w-24 overflow-hidden rounded-md border bg-white p-1.5'
const QR_IMG = 'h-full w-full object-contain'
const PLATFORM_TITLE = 'text-xs font-semibold text-foreground/80'
const MUTED_LINK = 'text-muted-foreground transition-colors hover:text-primary'

const SUPPORTED: readonly Icon[] = [
  { nameKey: 'platforms.n8n', src: '/footer/awsp/n8n.png' },
  { nameKey: 'platforms.coze', src: '/footer/awsp/coze.png' },
]
const MODELS: readonly Icon[] = [
  { nameKey: 'modelItems.gpt', src: '/footer/model/2.png' },
  { nameKey: 'modelItems.claude', src: '/footer/model/3x.png' },
  { nameKey: 'modelItems.gemini', src: '/footer/model/4.png' },
  { nameKey: 'modelItems.deepseek', src: '/footer/model/5.png' },
  { nameKey: 'modelItems.qwen', src: '/footer/model/6.png' },
  { nameKey: 'modelItems.doubao', src: '/footer/model/7.png' },
  { nameKey: 'modelItems.llama', src: '/footer/model/8x.png' },
  { nameKey: 'modelItems.mistral', src: '/footer/model/9.png' },
]
const PAYMENTS: readonly Icon[] = [
  { nameKey: 'payments.wechat', src: '/footer/zf/weixin.svg' },
  { nameKey: 'payments.alipay', src: '/footer/zf/zfb.svg' },
  { nameKey: 'payments.douyin', src: '/footer/zf/dy.svg' },
  { nameKey: 'payments.unionpay', src: '/footer/zf/yl.svg' },
  { nameKey: 'payments.visa', src: '/footer/zf/visa.svg' },
]
const DATABASES: readonly Icon[] = [
  { nameKey: 'databases.mysql', src: '/footer/shujuku/1.png' },
  { nameKey: 'databases.postgresql', src: '/footer/shujuku/2.png' },
  { nameKey: 'databases.mongodb', src: '/footer/shujuku/3.png' },
  { nameKey: 'databases.redis', src: '/footer/shujuku/4.png' },
  { nameKey: 'databases.sqlite', src: '/footer/shujuku/5.png' },
]
const PROMOTIONS: readonly Icon[] = [
  { nameKey: 'promos.promo1', src: '/footer/tuiguangpingtai/1.png' },
  { nameKey: 'promos.promo2', src: '/footer/tuiguangpingtai/2.png' },
  { nameKey: 'promos.promo3', src: '/footer/tuiguangpingtai/3.png' },
  { nameKey: 'promos.promo4', src: '/footer/tuiguangpingtai/4.png' },
  { nameKey: 'promos.promo5', src: '/footer/tuiguangpingtai/5.png' },
  { nameKey: 'promos.promo6', src: '/footer/tuiguangpingtai/6.png' },
  { nameKey: 'promos.promo7', src: '/footer/tuiguangpingtai/7.png' },
  { nameKey: 'promos.promo8', src: '/footer/tuiguangpingtai/8.png' },
  { nameKey: 'promos.x', src: '/footer/tuiguangpingtai/9.png', href: 'https://x.com/ok502319984' },
  {
    nameKey: 'promos.facebook',
    src: '/footer/tuiguangpingtai/10.png',
    href: 'https://www.facebook.com/share/17kQMPNhQb/',
  },
  { nameKey: 'promos.promo11', src: '/footer/tuiguangpingtai/11.png' },
  { nameKey: 'promos.promo12', src: '/footer/tuiguangpingtai/12.png' },
  { nameKey: 'promos.promo14', src: '/footer/tuiguangpingtai/14.png' },
  { nameKey: 'promos.promo15', src: '/footer/tuiguangpingtai/15.png' },
  {
    nameKey: 'promos.github',
    src: '/footer/tuiguangpingtai/16.png',
    href: 'https://github.com/AIZHS2025',
  },
  { nameKey: 'promos.promo17', src: '/footer/tuiguangpingtai/17.png' },
]
const QUICK_LINKS: readonly Link_[] = [
  { labelKey: 'about', href: '/about' },
  { labelKey: 'help', href: '/help' },
  { labelKey: 'feedback', href: '/feedback' },
  { labelKey: 'privacyPolicy', href: '/agreement/privacy' },
  { labelKey: 'termsOfService', href: '/agreement/terms' },
  { labelKey: 'userAgreement', href: '/agreement' },
]
const QRS: readonly Qr[] = [
  { src: '/footer/erweima/footer-icon-2.png', altKey: 'officialApp' },
  { src: '/footer/erweima/footer-icon-3.png', altKey: 'contactUs' },
]

function PlatformIcon({ name, src, href }: { name: string; src: string; href?: string }) {
  const img = (
    <img
      src={src}
      alt={name}
      width={24}
      height={24}
      className={ICON_IMG}
      loading="eager"
      decoding="sync"
    />
  )
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={name} className={ICON_BOX}>
        {img}
      </a>
    )
  }
  return (
    <div title={name} className={ICON_BOX}>
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
      <h4 className={PLATFORM_TITLE}>{title}</h4>
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
                <Link key={l.href} href={l.href} className={MUTED_LINK}>
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

          {/* 推广平台 + 二维码 */}
          <div className="space-y-3">
            <PlatformGroup title={t('officialPromotion')} items={PROMOTIONS} t={t} />
            <div className="flex gap-5 pt-2">
              {QRS.map((q) => (
                <div key={q.src} className="flex flex-col items-center gap-1.5">
                  <div className={QR_BOX}>
                    <img
                      src={q.src}
                      alt={t(q.altKey)}
                      width={88}
                      height={88}
                      className={QR_IMG}
                      loading="eager"
                      decoding="sync"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{t(q.altKey)}</span>
                </div>
              ))}
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
              loading="eager"
              decoding="sync"
            />
            <span>{t('icp')}</span>
            <span className="mx-1">·</span>
            <span>{t('copyright')}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/agreement" className="hover:text-primary">
              {tRoutes('userAgreement')}
            </Link>
            <Link href="/agreement/privacy" className="hover:text-primary">
              {tRoutes('privacyPolicy')}
            </Link>
            <Link href="/support" className="hover:text-primary">
              {t('contactUs')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
