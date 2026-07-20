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
import { AgreementDialog } from './AgreementDialog'
import { ContactDialog } from './ContactDialog'

/**
 * SiteFooter — 公司信息 + 生态平台 + 推广平台 + 二维码 + 协议/联系弹窗
 *
 * 布局(v5 — 2026-07-20 第四次重构,用户反馈"排版还是很难看"):
 *   Row 1: 3 栏 grid
 *     - 公司信息(精简,名称 + 地址 + 联系方式)
 *     - 生态合作(支持/模型/支付/数据库 合并 1 个 section,所有 icons 紧凑排列)
 *     - 官方推广(PROMOTIONS icons + 2 个 QR 紧凑排列)
 *   Row 2(border-top 分隔):
 *     - 左:链接行(关于/帮助/反馈 Link + 用户协议/隐私政策/联系我们 Dialog)
 *     - 右:ICP + 版权
 *
 * 历史变更:
 * - v5(2026-07-20):合并 4 个子标题为 1"生态合作"、缩小 icon/QR、链接内联到底部行、
 *   QR 副标题从"联系我们"改"官方微信"避免重复、补齐 4 个缺失 i18n key、
 *   移除 mt-auto(footer 高度动态,mt-auto 不生效,改为自然 flow)。
 * - v4(2026-07-20):py-2 md:py-3,gap-2,grid gap-4,space-y-1.5,移除重复链接,
 *   加 Dialog 弹窗触发行。
 * - v3:Dialog 弹窗替换页面跳转(用户要求"弹窗窗口 而不是完整页面")。
 */

type Link_ = { readonly labelKey: string; readonly href: string }

// 链接行(关于/帮助/反馈)— 业务页面,放 footer 底部行
const QUICK_LINKS: readonly Link_[] = [
  { labelKey: 'about', href: '/about' },
  { labelKey: 'help', href: '/help' },
  { labelKey: 'feedback', href: '/feedback' },
]

// 合并 4 类生态平台 → 1 个 section(消除 3 个子标题节省 ~60px 垂直空间)
const ECOSYSTEM: readonly Icon[] = [...SUPPORTED, ...MODELS, ...PAYMENTS, ...DATABASES]

// 排版原子 — 集中定义,避免散落
const SECTION_TITLE = 'text-xs font-semibold text-foreground/80'
const ICON_BOX = 'flex h-7 w-7 items-center justify-center rounded border bg-card transition-colors hover:border-primary/40'
const ICON_IMG = 'h-5 w-5 object-contain'
// 3 个 QR(官方应用/官方微信/企微社区群)— 缩到 h-16 w-16 才能在 col 3 一行排开
const QR_BOX = 'h-16 w-16 overflow-hidden rounded border border-zinc-900 bg-zinc-900 p-0.5'
const QR_IMG = 'h-full w-full object-contain'
const FOOTER_LINK = 'text-muted-foreground transition-colors hover:text-primary'
const FOOTER_BTN = 'text-muted-foreground transition-colors hover:text-primary cursor-pointer'

// mono 图标的 filter 适配类
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
      width={20}
      height={20}
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

function QrItem({ qr, t }: { qr: Qr; t: ReturnType<typeof useTranslations<'footer'>> }) {
  const img = (
    <img
      src={qr.src}
      alt={t(qr.altKey)}
      width={56}
      height={56}
      className={QR_IMG}
      {...IMG_EAGER}
    />
  )
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        title={t(qr.altKey)}
        className="cursor-pointer transition-opacity hover:opacity-80"
      >
        <div className={QR_BOX}>{img}</div>
      </div>
      <span className="text-[10px] leading-tight text-muted-foreground">{t(qr.altKey)}</span>
    </div>
  )
}

/**
 * Dialog 触发按钮 hook(用户协议/隐私政策/联系我们共享逻辑)
 * 同一时刻只允许一个 dialog 打开(避免多个 Dialog 状态相互干扰)
 */
function useDialogSwitch() {
  const [openType, setOpenType] = React.useState<null | 'user' | 'privacy' | 'contact'>(null)
  return {
    isUserOpen: openType === 'user',
    isPrivacyOpen: openType === 'privacy',
    isContactOpen: openType === 'contact',
    open: (t: 'user' | 'privacy' | 'contact') => setOpenType(t),
    close: () => setOpenType(null),
    onUserOpenChange: (v: boolean) => setOpenType(v ? 'user' : null),
    onPrivacyOpenChange: (v: boolean) => setOpenType(v ? 'privacy' : null),
    onContactOpenChange: (v: boolean) => setOpenType(v ? 'contact' : null),
  }
}

export function SiteFooter({ className }: { className?: string }) {
  const t = useTranslations('footer')
  const tRoutes = useTranslations('routes')
  const dlg = useDialogSwitch()

  return (
    // v5 排版:py-1.5 md:py-2(比 v4 再省 4-8px),gap-1.5(比 v4 再省 4px)
    <footer
      className={`border-t bg-card/50 px-4 py-1.5 md:px-8 md:py-2${className ? ` ${className}` : ''}`}
    >
      <div className="flex w-full flex-col gap-1.5">
        {/* Row 1: 3 栏精简 grid
            - gap-3(比 v4 的 gap-4 再省 8px 横向)
            - md:items-start 让 3 栏顶部对齐,生态合作栏不会把其他栏撑高
            - 中栏比例 1.5(给 20 个 icons 更多空间),边栏 1 */}
        <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_1fr] md:items-start">
          {/* 栏 1: 公司信息(精简,无冗余 padding)
              - 标题 + 单段地址/电话/邮箱(原 4 行 list 合并为 1 段,节省 ~30px)
              - 无 sub-links(全部移到底部链接行,避免重复) */}
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold">{t('companyName')}</h3>
            <p className="text-xs leading-snug text-muted-foreground">
              {t('addressLine1')}
              <br />
              {t('addressLine2')}
            </p>
            <p className="text-xs leading-snug text-muted-foreground">
              {t('companyContact')} · {t('companyEmail')}
            </p>
          </div>

          {/* 栏 2: 生态合作(单 section,4 类 20 icons 合并)
              - 无 4 个子标题(节省 ~60px 垂直)
              - icon 缩小到 h-7 w-7(从 h-9 w-9 减 8px)
              - gap 1.5(从 2 减 2px),密度更紧 */}
          <div className="space-y-1">
            <h4 className={SECTION_TITLE}>{t('ecosystem')}</h4>
            <div className="flex flex-wrap gap-1.5">
              {ECOSYSTEM.map((p) => (
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

          {/* 栏 3: 官方推广 + QR
              - 推广 icons 紧凑(同生态合作风格)
              - QR 缩小到 h-20 w-20(从 h-24 w-24 减 16px)
              - 副标题字号 10px(从 12px 减 2px)
              - 关键:微信 QR 副标题用"官方微信"而不是"联系我们",
                避免跟 Dialog 触发行"联系我们"按钮重复 */}
          <div className="space-y-1">
            <h4 className={SECTION_TITLE}>{t('officialPromotion')}</h4>
            <div className="flex flex-wrap gap-1.5">
              {PROMOTIONS.map((p) => (
                <PlatformIcon
                  key={p.nameKey}
                  name={t(p.nameKey)}
                  src={p.src}
                  mono={p.mono}
                  {...(p.href ? { href: p.href } : {})}
                />
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              {QRS.map((q) => (
                <QrItem key={q.src} qr={q} t={t} />
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: 链接 + ICP 版权(单行,border-top 分隔)
            v5 关键改进:把原 3 个 Dialog 触发按钮 + 原 3 个 quick links 合并到
            1 行,消除"分两行展示"的冗余。
            - 6 个链接用 · 分隔(更紧凑)
            - 左侧链接组 + 右侧 ICP 版权,justify-between 两端对齐
            - 不再用 mt-auto(footer 高度动态,mt-auto 不生效;改用自然 flow,
              border-top 视觉上自然分割) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-1 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {QUICK_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={FOOTER_LINK}>
                {tRoutes(l.labelKey)}
              </Link>
            ))}
            <span className="text-border">·</span>
            <button type="button" onClick={() => dlg.open('user')} className={FOOTER_BTN}>
              {tRoutes('userAgreement')}
            </button>
            <button type="button" onClick={() => dlg.open('privacy')} className={FOOTER_BTN}>
              {tRoutes('privacyPolicy')}
            </button>
            <button type="button" onClick={() => dlg.open('contact')} className={FOOTER_BTN}>
              {t('contactUs')}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <img
              src="/footer/erweima/footer-icon-1.png"
              alt={t('icp')}
              width={14}
              height={14}
              className="h-3.5 w-3.5 object-contain"
              {...IMG_EAGER}
            />
            <span>{t('icp')}</span>
            <span>·</span>
            <span>{t('copyright')}</span>
          </div>
        </div>
      </div>

      {/* Dialog 实例(全局挂一个,通过 open prop 控制显隐) */}
      <AgreementDialog type="user" open={dlg.isUserOpen} onOpenChange={dlg.onUserOpenChange} />
      <AgreementDialog
        type="privacy"
        open={dlg.isPrivacyOpen}
        onOpenChange={dlg.onPrivacyOpenChange}
      />
      <ContactDialog open={dlg.isContactOpen} onOpenChange={dlg.onContactOpenChange} />
    </footer>
  )
}
