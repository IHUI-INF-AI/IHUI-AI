'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

interface QrCode {
  titleKey: string
  src: string
}

const QR_CODES: QrCode[] = [
  { titleKey: 'qr1', src: '/footer/erweima/footer-icon-1.png' },
  { titleKey: 'qr2', src: '/footer/erweima/footer-icon-2.png' },
  { titleKey: 'qr3', src: '/footer/erweima/footer-icon-3.png' },
]

const PAY_ICONS = [
  { name: '微信', src: '/footer/zf/weixin@1x.png' },
  { name: '支付宝', src: '/footer/zf/zfb.png' },
  { name: '抖音', src: '/footer/zf/DY.png' },
  { name: '银联', src: '/footer/zf/YL.png' },
  { name: 'VISA', src: '/footer/zf/VISA.png' },
]

interface FooterLink {
  labelKey: string
  href: string
}

interface FooterColumn {
  titleKey: string
  links: FooterLink[]
}

export function SiteFooter() {
  const t = useTranslations('marketing.footer')

  const columns = t.raw('columns') as FooterColumn[]

  return (
    <footer className="mt-12 border-t bg-card/50">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          {/* 品牌区 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Image
                src="/images/logo.png?v=20260719-unify"
                alt={t('brand')}
                width={28}
                height={28}
              />
              <span className="text-base font-semibold">{t('brand')}</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{t('desc')}</p>
            <p className="text-xs text-muted-foreground">{t('slogan')}</p>
          </div>

          {/* 链接列 */}
          {columns.map((col, i) => (
            <div key={i} className="space-y-2">
              <h3 className="text-sm font-semibold">{t(col.titleKey)}</h3>
              <ul className="space-y-1.5">
                {col.links.map((l, j) => (
                  <li key={j}>
                    <Link
                      href={l.href}
                      className="text-xs text-muted-foreground transition-colors hover:text-primary"
                    >
                      {t(l.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* 二维码区 */}
        <div className="mt-8 flex flex-wrap items-center gap-6 border-t pt-6">
          <div className="flex gap-4">
            {QR_CODES.map((qr, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1.5">
                <div className="h-20 w-20 overflow-hidden rounded-md border bg-white p-1">
                  <Image
                    src={qr.src}
                    alt={t(qr.titleKey)}
                    width={72}
                    height={72}
                    className="h-full w-full object-contain"
                    unoptimized
                  />
                </div>
                <span className="text-xs text-muted-foreground">{t(qr.titleKey)}</span>
              </div>
            ))}
          </div>

          <div className="ml-auto flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {PAY_ICONS.map((p) => (
                <div
                  key={p.name}
                  className="flex h-7 w-10 items-center justify-center rounded border bg-white px-1"
                  title={p.name}
                >
                  <Image
                    src={p.src}
                    alt={p.name}
                    width={32}
                    height={20}
                    className="max-h-full w-auto object-contain"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 版权 */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
          <span>{t('copyright')}</span>
          <div className="flex items-center gap-4">
            <Link href="/agreement" className="hover:text-primary">
              {t('agreement')}
            </Link>
            <Link href="/agreement/privacy" className="hover:text-primary">
              {t('privacy')}
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
