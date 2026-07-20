'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
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
import { Tooltip } from '@/components/feedback'

/**
 * SiteFooter — 公司信息 + 生态平台 + 推广平台 + 二维码 + 协议/联系弹窗
 *
 * 布局(v6 — 2026-07-20 第五次重构,用户二次反馈"排版还是很难看"):
 *   Row 1: 3 栏 grid
 *     - 公司信息(精简)
 *     - 生态合作(支持/模型/支付/数据库 合并 1 个 section,所有 icons 紧凑排列)
 *     - 官方推广(PROMOTIONS icons + 3 个 QR 紧凑排列)
 *   Row 2(border-top 分隔):
 *     - 左:3 个 Dialog 按钮(用户协议/隐私政策/联系我们)
 *     - 右:ICP + 版权
 *
 * 历史变更:
 * - v6(2026-07-20):py-1 md:py-1.5(从 py-1.5 md:py-2 再省 2px),
 *   gap-1(从 gap-1.5 再省 2px),grid gap-2(从 gap-3 再省 4px),
 *   icons h-6 w-6(从 h-7 w-7 减 4px),QR h-14 w-14(从 h-16 w-16 减 8px),
 *   section title text-[10px](从 text-xs 再省 2px),row 2 pt-0.5(从 pt-1 再省 2px),
 *   关键:**删除 与 sidebar 重复的 3 个 Link(关于/帮助/反馈)**,
 *   底部行只保留 3 个 Dialog button + ICP+版权,信息更纯粹。
 * - v5(2026-07-20):合并 4 个子标题为 1"生态合作"、缩小 icon/QR、链接内联到底部行。
 * - v4(2026-07-20):py-2 md:py-3,gap-2,grid gap-4,加 Dialog 弹窗触发行。
 * - v3:Dialog 弹窗替换页面跳转(用户要求"弹窗窗口 而不是完整页面")。
 */

// 合并 4 类生态平台 → 1 个 section(消除 3 个子标题节省 ~60px 垂直空间)
const ECOSYSTEM: readonly Icon[] = [...SUPPORTED, ...MODELS, ...PAYMENTS, ...DATABASES]

// 排版原子 — v6 进一步压缩
// - section title: text-[10px](从 text-xs 减 2px) + uppercase 风格更克制
// - icon box: h-6 w-6(从 h-7 w-7 减 4px),保持 36×36 触摸目标依赖 padding
// - QR box: h-14 w-14(从 h-16 w-16 减 8px),hover 弹 240px 大图不受影响
const SECTION_TITLE = 'text-[10px] font-semibold uppercase tracking-wider text-foreground/60'
const ICON_BOX =
  'flex h-6 w-6 items-center justify-center rounded border bg-card transition-colors hover:border-primary/40'
const ICON_IMG = 'h-4 w-4 object-contain'
const QR_BOX = 'h-14 w-14 overflow-hidden rounded border border-zinc-900 bg-zinc-900 p-0.5'
const QR_IMG = 'h-full w-full object-contain'
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
      width={16}
      height={16}
      className={`${ICON_IMG}${mono ? ` ${MONO_FILTER}` : ''}`}
      {...IMG_EAGER}
    />
  )
  const className = ICON_BOX
  if (href) {
    return (
      <Tooltip content={name}>
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
          {img}
        </a>
      </Tooltip>
    )
  }
  return (
    <Tooltip content={name}>
      <div className={className}>
        {img}
      </div>
    </Tooltip>
  )
}

function QrItem({ qr, t }: { qr: Qr; t: ReturnType<typeof useTranslations<'footer'>> }) {
  const img = (
    <img src={qr.src} alt={t(qr.altKey)} width={48} height={48} className={QR_IMG} {...IMG_EAGER} />
  )

  // 2026-07-20:action='copy' → 点击复制 copyValue(如微信号)到剪贴板 + sonner toast 引导
  // 历史:曾用 weixin:// 协议,PC 微信 4.x 已关闭协议跳转,改用复制最稳
  const handleCopy = React.useCallback(async () => {
    if (qr.action !== 'copy' || !qr.copyValue) return
    const val = qr.copyValue
    try {
      await navigator.clipboard.writeText(val)
      toast.success(`已复制微信号 ${val}`, {
        description: '打开微信 → 顶部搜索框粘贴 → 添加到通讯录',
        duration: 4000,
      })
    } catch {
      // 兜底:旧浏览器/非 HTTPS 环境(localhost 用 execCommand)
      const ta = document.createElement('textarea')
      ta.value = val
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        toast.success(`已复制微信号 ${val}`, {
          description: '打开微信 → 顶部搜索框粘贴 → 添加到通讯录',
          duration: 4000,
        })
      } catch {
        toast.error('复制失败,请手动输入微信号')
      } finally {
        document.body.removeChild(ta)
      }
    }
  }, [qr.action, qr.copyValue])

  // action='copy' 用 <button>(无障碍 + 键盘 Enter 触发);普通二维码用 <div>
  const trigger = qr.action === 'copy' ? (
    <Tooltip content={`点击复制微信号: ${qr.copyValue ?? ''}`}>
      <button
        type="button"
        onClick={handleCopy}
        className="cursor-pointer transition-opacity hover:opacity-80"
      >
        <div className={QR_BOX}>{img}</div>
      </button>
    </Tooltip>
  ) : (
    <Tooltip content={t(qr.altKey)}>
      <div className="cursor-pointer transition-opacity hover:opacity-80">
        <div className={QR_BOX}>{img}</div>
      </div>
    </Tooltip>
  )

  return (
    <div className="group/qr relative flex flex-col items-center gap-0.5">
      {trigger}
      {/*
        2026-07-20 加:hover 放大弹窗(240px 二维码大图),扫码更友好。
        - v6 缩略图 48px(从 56px 减 8px,配合 QR_BOX 56px),扫码距离屏幕较远时难识别,
          hover 弹 240px 大图(5× 放大)补救
        - 位置:absolute bottom-full 弹在 trigger 上方,left-1/2 -translate-x-1/2 水平居中
        - 默认 scale-95 + opacity-0,group-hover/qr 时 scale-100 + opacity-100,
          transition-all duration-200 滑入
        - pointer-events-none 避免弹窗遮挡 trigger 自身 hover
        - bg-popover + border + shadow-lg 与项目 Popover 视觉一致;无圆角违规
      */}
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-popover mb-2 -translate-x-1/2 scale-95 opacity-0 transition-all duration-200 group-hover/qr:scale-100 group-hover/qr:opacity-100"
      >
        <div className="rounded-md border bg-popover p-2 shadow-lg">
          <div className="h-[240px] w-[240px] overflow-hidden rounded-sm bg-zinc-900 p-3">
            <img
              src={qr.src}
              alt={t(qr.altKey)}
              width={240}
              height={240}
              className="h-full w-full object-contain"
              loading="eager"
              decoding="sync"
            />
          </div>
        </div>
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
    // v6 排版(2026-07-20 第五次重构,用户二次反馈"排版还是很难看"):
    // - py-1 md:py-1.5(从 py-1.5 md:py-2 再省 2px 上下 padding,footer 整体更窄)
    // - 内部 gap-1(从 gap-1.5 再省 2px)
    // - 取消 max-w-7xl mx-auto,撑满 w-full,与 page-4 容器左右对齐
    <footer
      className={`border-t bg-card/50 px-4 py-1 md:px-8 md:py-1.5${className ? ` ${className}` : ''}`}
    >
      <div className="flex w-full flex-col gap-1">
        {/* Row 1: 3 栏精简 grid
            - v6 gap-2(从 gap-3 再省 4px 横向)
            - md:items-start 让 3 栏顶部对齐,生态合作栏不会把其他栏撑高
            - 中栏比例 1.5(给 20 个 icons 更多空间),边栏 1 */}
        <div className="grid gap-2 md:grid-cols-[1fr_1.5fr_1fr] md:items-start">
          {/* 栏 1: 公司信息(精简)
              - v6 标题 text-xs(从 text-sm 减 2px)
              - 文本 text-[10px](从 text-xs 减 2px)更克制 */}
          <div className="space-y-0.5">
            <h3 className="text-xs font-semibold">{t('companyName')}</h3>
            <p className="text-[10px] leading-snug text-muted-foreground">
              {t('addressLine1')}
              <br />
              {t('addressLine2')}
            </p>
            <p className="text-[10px] leading-snug text-muted-foreground">
              {t('companyContact')} · {t('companyEmail')}
            </p>
          </div>

          {/* 栏 2: 生态合作(单 section,4 类 20 icons 合并)
              - v6 icon 缩小到 h-6 w-6(从 h-7 w-7 减 4px)
              - gap-1(从 gap-1.5 减 2px),密度更紧 */}
          <div className="space-y-0.5">
            <h4 className={SECTION_TITLE}>{t('ecosystem')}</h4>
            <div className="flex flex-wrap gap-1">
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
              - v6 QR 缩小到 h-14 w-14(从 h-16 w-16 减 8px)
              - gap-1.5(从 gap-2 减 2px)
              - pt-0.5(从 pt-1 减 2px) */}
          <div className="space-y-0.5">
            <h4 className={SECTION_TITLE}>{t('officialPromotion')}</h4>
            <div className="flex flex-wrap gap-1">
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
            <div className="flex gap-1.5 pt-0.5">
              {QRS.map((q) => (
                <QrItem key={q.src} qr={q} t={t} />
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: 3 个 Dialog + 1 个 /about Link + ICP 版权
            2026-07-20 v6.1 调整(用户反馈"你删的 Link 在哪里访问"):
            - /help 和 /feedback 在 sidebar 已有入口(帮助+帮助中心 / 反馈+意见反馈),
              确认可点击 → 维持删除。
            - /about 页面存在但 sidebar 没有"关于我们"入口,是营销页用户访问
              "关于智汇 AI" 的唯一通道 → 恢复 1 个 Link,与 3 个 Dialog 并列。
            - 整体保持 4 个交互项 + ICP+版权,无重复冗余。 */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-0.5 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <Link
              href="/about"
              className={FOOTER_BTN}
              onClick={() => {
                if (typeof window !== 'undefined') window.scrollTo(0, 0)
              }}
            >
              {t('aboutUs')}
            </Link>
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
          <div className="flex items-center gap-1.5">
            <img
              src="/footer/erweima/footer-icon-1.png"
              alt={t('icp')}
              width={12}
              height={12}
              className="h-3 w-3 object-contain"
              {...IMG_EAGER}
            />
            <span>{t('icp')}</span>
            <span className="text-border">·</span>
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
