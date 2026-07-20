'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

/**
 * SiteFooter — 还原历史 Vue 版完整 footer(a754adc0: client/src/components/Footer.vue)
 *
 * 三大区块:
 * 1. 左侧:公司信息(名称/地址/电话/邮箱)+ 6 个快速链接
 * 2. 中部:4 类平台 Logo(支持接入 2 / 模型 8 / 支付 5 / 云数据库 5)
 * 3. 右侧:官方推广平台 16 槽位 + 2 个固定二维码(官方应用 / 联系我们)
 * 4. 底部:ICP 备案 + 版权 + 协议链接
 *
 * i18n:直接复用根命名空间 `footer.*`(历史 Vue 版迁移过来,5 语言已 parity)
 *      快速链接文案用 `routes.*`
 * 资源:直接复用 public/footer/(路径与 Vue 版完全一致)
 * 推广平台 hover 二维码因迁移时丢失 promotion-qr-* 资源,简化为外链 + title 提示。
 */
const SUPPORTED_PLATFORMS = [
  { name: 'n8n', src: '/footer/awsp/n8n.png' },
  { name: 'Coze', src: '/footer/awsp/coze.png' },
]

const MODELS = [
  { name: 'GPT', src: '/footer/model/2.png' },
  { name: 'Claude', src: '/footer/model/3x.png' },
  { name: 'Gemini', src: '/footer/model/4.png' },
  { name: 'DeepSeek', src: '/footer/model/5.png' },
  { name: 'Qwen', src: '/footer/model/6.png' },
  { name: 'Doubao', src: '/footer/model/7.png' },
  { name: 'Llama', src: '/footer/model/8x.png' },
  { name: 'Mistral', src: '/footer/model/9.png' },
]

const PAYMENTS = [
  { name: '微信', src: '/footer/zf/weixin.svg' },
  { name: '支付宝', src: '/footer/zf/zfb.svg' },
  { name: '抖音', src: '/footer/zf/dy.svg' },
  { name: '银联', src: '/footer/zf/yl.svg' },
  { name: 'VISA', src: '/footer/zf/visa.svg' },
]

const DATABASES = [
  { name: 'MySQL', src: '/footer/shujuku/1.png' },
  { name: 'PostgreSQL', src: '/footer/shujuku/2.png' },
  { name: 'MongoDB', src: '/footer/shujuku/3.png' },
  { name: 'Redis', src: '/footer/shujuku/4.png' },
  { name: 'SQLite', src: '/footer/shujuku/5.png' },
]

// 推广平台 16 槽位(对应历史 Vue promotionQrs 数组)
// 9/10/16 是外链,其余展示 Logo + title 提示
const PROMOTIONS = [
  { name: '推广-1', src: '/footer/tuiguangpingtai/1.png' },
  { name: '推广-2', src: '/footer/tuiguangpingtai/2.png' },
  { name: '推广-3', src: '/footer/tuiguangpingtai/3.png' },
  { name: '推广-4', src: '/footer/tuiguangpingtai/4.png' },
  { name: '推广-5', src: '/footer/tuiguangpingtai/5.png' },
  { name: '推广-6', src: '/footer/tuiguangpingtai/6.png' },
  { name: '推广-7', src: '/footer/tuiguangpingtai/7.png' },
  { name: '推广-8', src: '/footer/tuiguangpingtai/8.png' },
  { name: 'X', src: '/footer/tuiguangpingtai/9.png', href: 'https://x.com/ok502319984' },
  { name: 'Facebook', src: '/footer/tuiguangpingtai/10.png', href: 'https://www.facebook.com/share/17kQMPNhQb/' },
  { name: '推广-11', src: '/footer/tuiguangpingtai/11.png' },
  { name: '推广-12', src: '/footer/tuiguangpingtai/12.png' },
  { name: '推广-14', src: '/footer/tuiguangpingtai/14.png' },
  { name: '推广-15', src: '/footer/tuiguangpingtai/15.png' },
  { name: 'GitHub', src: '/footer/tuiguangpingtai/16.png', href: 'https://github.com/AIZHS2025' },
  { name: '推广-17', src: '/footer/tuiguangpingtai/17.png' },
]

const QUICK_LINKS_ROW_1 = [
  { labelKey: 'about', href: '/about' },
  { labelKey: 'help', href: '/help' },
  { labelKey: 'feedback', href: '/feedback' },
]

const QUICK_LINKS_ROW_2 = [
  { labelKey: 'privacyPolicy', href: '/agreement/privacy' },
  { labelKey: 'termsOfService', href: '/agreement/terms' },
  { labelKey: 'userAgreement', href: '/agreement' },
]

function PlatformIcon({ name, src, href }: { name: string; src: string; href?: string }) {
  const inner = (
    <Image
      src={src}
      alt={name}
      width={24}
      height={24}
      className="h-6 w-6 object-contain"
      unoptimized
    />
  )
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={name}
        className="flex h-8 w-8 items-center justify-center rounded border bg-white px-1 transition-colors hover:border-primary/40"
      >
        {inner}
      </a>
    )
  }
  return (
    <div
      title={name}
      className="flex h-8 w-8 items-center justify-center rounded border bg-white px-1 transition-colors hover:border-primary/40"
    >
      {inner}
    </div>
  )
}

function PlatformGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold text-foreground/80">{title}</h4>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

export function SiteFooter() {
  const t = useTranslations('footer')
  const tRoutes = useTranslations('routes')

  return (
    <footer className="mt-12 border-t bg-card/50">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        {/* 三栏布局:公司信息 | 4 类平台 Logo | 推广平台 + 二维码 */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* 左侧:公司信息 + 快速链接 */}
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
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs">
              {QUICK_LINKS_ROW_1.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-muted-foreground transition-colors hover:text-primary"
                >
                  {tRoutes(l.labelKey)}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {QUICK_LINKS_ROW_2.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-muted-foreground transition-colors hover:text-primary"
                >
                  {tRoutes(l.labelKey)}
                </Link>
              ))}
            </div>
          </div>

          {/* 中部:4 类平台 Logo */}
          <div className="space-y-3">
            <PlatformGroup title={t('supportedPlatforms')}>
              {SUPPORTED_PLATFORMS.map((p) => (
                <PlatformIcon key={p.name} {...p} />
              ))}
            </PlatformGroup>
            <PlatformGroup title={t('models')}>
              {MODELS.map((p) => (
                <PlatformIcon key={p.name} {...p} />
              ))}
            </PlatformGroup>
            <PlatformGroup title={t('paymentPlatforms')}>
              {PAYMENTS.map((p) => (
                <PlatformIcon key={p.name} {...p} />
              ))}
            </PlatformGroup>
            <PlatformGroup title={t('cloudDatabases')}>
              {DATABASES.map((p) => (
                <PlatformIcon key={p.name} {...p} />
              ))}
            </PlatformGroup>
          </div>

          {/* 右侧:推广平台 + 2 个固定二维码 */}
          <div className="space-y-3">
            <PlatformGroup title={t('officialPromotion')}>
              {PROMOTIONS.map((p) => (
                <PlatformIcon key={p.name} {...p} />
              ))}
            </PlatformGroup>

            <div className="flex gap-4 pt-2">
              <div className="flex flex-col items-center gap-1">
                <div className="h-20 w-20 overflow-hidden rounded-md border bg-white p-1">
                  <Image
                    src="/footer/erweima/footer-icon-2.png"
                    alt={t('officialApp')}
                    width={72}
                    height={72}
                    className="h-full w-full object-contain"
                    unoptimized
                  />
                </div>
                <span className="text-xs text-muted-foreground">{t('officialApp')}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="h-20 w-20 overflow-hidden rounded-md border bg-white p-1">
                  <Image
                    src="/footer/erweima/footer-icon-3.png"
                    alt={t('contactUs')}
                    width={72}
                    height={72}
                    className="h-full w-full object-contain"
                    unoptimized
                  />
                </div>
                <span className="text-xs text-muted-foreground">{t('contactUs')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 底部:ICP 备案 + 版权 + 协议链接 */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Image
              src="/footer/erweima/footer-icon-1.png"
              alt={t('icp')}
              width={16}
              height={16}
              className="h-4 w-4 object-contain"
              unoptimized
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
