'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
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
 *   3. 官方推广平台 16 槽位 + 官方应用 QR + 微信联系 QR
 * 底部:ICP 备案 + 版权 + 协议链接
 *
 * 图片数据集中在 `footer-data.ts`,与 BrandMarquee 共享单一来源。
 * i18n 全部走 `footer.*` / `routes.*`,5 语言已 parity。
 *
 * 2026-07-20 修复:
 * - ICON_BOX 背景从 bg-white 改 bg-foreground/[0.04],让 model/3x(Claude 白底透明)
 *   + awsp/n8n(白底透明)+ tuiguangpingtai/3/5/11(白底透明)等图标在白卡上可见。
 * - QR_BOX 改 bg-zinc-900(始终深色),让 footer-icon-2.png 的白色 QR 码在亮/暗模式都可见。
 * - 联系二维码改用 wechat-vx.png(用户个人微信二维码),点击拉起 `weixin://` 协议
 *   → 浏览器询问是否打开微信 → 启动电脑微信,用户用「扫一扫」扫描屏幕二维码添加好友。
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
// 2026-07-20 改:bg-card 替代 bg-white 和上版的 bg-foreground/[0.04],
// 因为 white-on-transparent 图标现在通过 `invert dark:invert-0` filter 适配主题,
// 不再需要容器加浅灰底。bg-card 主题感知:亮色白底 / 暗色深底,白色图标始终可见。
const ICON_BOX =
  'flex h-9 w-9 items-center justify-center rounded-md border bg-card transition-colors hover:border-primary/40'
const ICON_IMG = 'h-6 w-6 object-contain'
// 2026-07-20 改:bg-zinc-900 始终深色,让 footer-icon-2.png 白色 QR 码在亮/暗模式都可见
const QR_BOX = 'h-24 w-24 overflow-hidden rounded-md border border-zinc-900 bg-zinc-900 p-1.5'
const QR_IMG = 'h-full w-full object-contain'
const COMPANY_LINK = 'text-muted-foreground transition-colors hover:text-primary'
const FOOTER_BOTTOM_LINK = 'transition-colors hover:text-primary'

// 2026-07-20 加:mono 图标的 filter 适配类
// 亮色模式: invert(100%) → 白图变黑(白底白图 → 黑底白图)
// 暗色模式: invert(0) → 还原原图(白图在深色背景上可见)
const MONO_FILTER = 'invert dark:invert-0'

function PlatformIcon({
  name,
  src,
  href,
  mono,
}: {
  name: string
  src: string
  href?: string
  mono?: boolean
}) {
  const img = (
    <img
      src={src}
      alt={name}
      width={24}
      height={24}
      className={`${ICON_IMG}${mono ? ` ${MONO_FILTER}` : ''}`}
      {...IMG_EAGER}
    />
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
            mono={p.mono}
            {...(p.href ? { href: p.href } : {})}
          />
        ))}
      </div>
    </div>
  )
}

function QrItem({ qr, t }: { qr: Qr; t: ReturnType<typeof useTranslations<'footer'>> }) {
  const img = (
    <img src={qr.src} alt={t(qr.altKey)} width={88} height={88} className={QR_IMG} {...IMG_EAGER} />
  )
  const box = <div className={QR_BOX}>{img}</div>
  // 有 href 时(如 weixin:// 拉起电脑微信)用 <a> 包裹,无 href 时保持纯展示
  return (
    <div className="flex flex-col items-center gap-1.5">
      {qr.href ? (
        <a href={qr.href} title={t(qr.altKey)} className="transition-opacity hover:opacity-80">
          {box}
        </a>
      ) : (
        box
      )}
      <span className="text-xs text-muted-foreground">{t(qr.altKey)}</span>
    </div>
  )
}

export function SiteFooter({ className }: { className?: string }) {
  const t = useTranslations('footer')
  const tRoutes = useTranslations('routes')

  return (
    // 2026-07-20 改(根因修复):footer 自身加 px-4 md:px-8,内部最外层 div 改 w-full
    // 去掉 max-w-7xl + mx-auto。原 max-w-7xl (1280px) 在大屏下让内容居中、左右留空,
    // 导致 footer 内部 div 边缘 != footer 标签边缘,与 page 4 magazine 容器
    // (flex-1 + px-4 md:px-8) 左右不匹配。改后 footer 内容 = magazine 内容
    // 横向缩进位置,左右完全吻合。
    <footer
      className={`border-t bg-card/50 px-4 pt-6 pb-1 md:px-8 md:pt-8 md:pb-2${
        className ? ` ${className}` : ''
      }`}
    >
      {/* 内部最外层 div 改 w-full,撑满 footer 自身 padding 后的空间,无 max-w 限制。
          这样 footer 内部 div 左右边界 = footer 标签内容区左右边界 = 视觉吻合 footer。 */}
      <div className="flex w-full flex-col gap-6">
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

          {/* 推广平台 + 二维码 */}
          <div className="space-y-3">
            <PlatformGroup title={t('officialPromotion')} items={PROMOTIONS} t={t} />
            <div className="flex gap-5 pt-2">
              {QRS.map((q) => (
                <QrItem key={q.src} qr={q} t={t} />
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
