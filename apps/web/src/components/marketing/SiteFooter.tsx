'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Clock, Copy, ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'
import {
  CHINESE_MODELS,
  DATABASES,
  IMG_EAGER,
  INTERNATIONAL_MODELS,
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
 * - v6(2026-07-20):py-1 min-[768px]:py-1.5(从 py-1.5 min-[768px]:py-2 再省 2px),
 *   gap-1(从 gap-1.5 再省 2px),grid grid-cols-1 gap-2(从 gap-3 再省 4px),
 *   icons h-6 w-6(从 h-7 w-7 减 4px),QR h-14 w-14(从 h-16 w-16 减 8px),
 *   section title text-[10px](从 text-xs 再省 2px),row 2 pt-0.5(从 pt-1 再省 2px),
 *   关键:**删除 与 sidebar 重复的 3 个 Link(关于/帮助/反馈)**,
 *   底部行只保留 3 个 Dialog button + ICP+版权,信息更纯粹。
 * - v5(2026-07-20):合并 4 个子标题为 1"生态合作"、缩小 icon/QR、链接内联到底部行。
 * - v4(2026-07-20):py-2 min-[768px]:py-3,gap-2,grid grid-cols-1 gap-4,加 Dialog 弹窗触发行。
 * - v3:Dialog 弹窗替换页面跳转(用户要求"弹窗窗口 而不是完整页面")。
 */

// 生态合作 5 类分组(2026-07-30 v11 拆分:原 4 类 → 5 类,模型拆为国际/国产 2 组)
// - 移动端/平板:grid-cols-2(2 列,5 类需换行 2-3 行)
// - 桌面 lg+:min-[1024px]:grid-cols-5(5 列,5 类 1 行;1024 边界 8 个图标分 2 组各 4 个,每列 4 个图标只换 1 行,布局更舒展)
const ECOSYSTEM_GROUPS: readonly { titleKey: string; items: readonly Icon[] }[] = [
  { titleKey: 'supportedPlatforms', items: SUPPORTED },
  { titleKey: 'internationalModels', items: INTERNATIONAL_MODELS },
  { titleKey: 'chineseModels', items: CHINESE_MODELS },
  { titleKey: 'paymentPlatforms', items: PAYMENTS },
  { titleKey: 'cloudDatabases', items: DATABASES },
]

// 排版原子 — v10 拉高放宽
// - footer padding py-2 min-[768px]:py-3(从 v9 py-0.5 min-[768px]:py-1 拉回,footer 整体从 95px → ~140px)
// - section title: text-[11px](从 v9 text-[10px] 放大 1px,可读性更佳)
// - icon box: h-7 w-7(从 h-5 w-5 放大 8px,触摸目标 + 视觉都更稳)
// - QR box: h-16 w-16(从 h-12 w-12 放大 16px,3 个 QR 完全可见 + 可扫)
// - ICP 图标: h-5 w-5(从 h-4 w-4 放大 4px,正常可见不糊)
// 2026-07-30 v10:用户反馈"footer 三个二维码被截断 + 备案图标未显示 + Tooltip 文字空白",
//   上一版 v9 紧凑化(95px)把 footer 压扁,3 个 QR + ICP 图标都肉眼难辨。
//   本轮反向:拉高 padding + 放大 icon/QR/ICP,footer 高度从 95px → 140px,
//   Page 7 同步减小 minHeight = calc(100vh - 1rem - 12rem) 让 footer 整体可见不被切。
const SECTION_TITLE = 'text-[11px] font-semibold uppercase tracking-wider text-foreground/60'
const ICON_BOX =
  'flex h-7 w-7 items-center justify-center rounded border bg-card transition-colors hover:border-primary/40'
const ICON_IMG = 'h-4 w-4 object-contain'
const QR_BOX = 'h-16 w-16 overflow-hidden rounded border border-zinc-900 bg-zinc-900 p-0.5'
const QR_IMG = 'h-full w-full object-contain'
const FOOTER_BTN = 'text-muted-foreground transition-colors hover:text-primary cursor-pointer'

// mono 图标(白前景+透明背景):亮色 invert 白→黑可见,暗色 invert-0 还原白
// darkInvert 图标(深色前景):亮色不动可见,暗色 invert 反相变白
// 其它(带颜色前景):不加任何 filter,保持原色
const MONO_FILTER = 'invert dark:invert-0'
const DARK_INVERT_FILTER = 'dark:invert'

function PlatformIcon({
  name,
  src,
  href,
  mono,
  darkInvert,
}: {
  name: string
  src: string
  href?: string
  mono?: boolean
  darkInvert?: boolean
}) {
  const filter = mono ? ` ${MONO_FILTER}` : darkInvert ? ` ${DARK_INVERT_FILTER}` : ''
  const img = (
    <Image
      src={src}
      alt={name}
      width={14}
      height={14}
      className={`${ICON_IMG}${filter}`}
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
      <div className={className}>{img}</div>
    </Tooltip>
  )
}

function QrItem({ qr, t }: { qr: Qr; t: ReturnType<typeof useTranslations<'footer'>> }) {
  const img = (
    <Image
      src={qr.src}
      alt={t(qr.altKey)}
      width={64}
      height={64}
      className={QR_IMG}
      {...IMG_EAGER}
    />
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
  // 2026-08-12 改:去掉 trigger 上的 <Tooltip> 包装(用户反馈"hover 时 Tooltip 提示窗
  // 跟放大的二维码窗重合,导致二维码底部看不全扫不上")
  // - 根因:Tooltip 弹"点击复制微信号"等文字,放大二维码窗也 absolute 定位在 trigger 上方,
  //   两者重叠,放大窗部分被 Tooltip 盖住
  // - 修复:用 aria-label 替代 Tooltip 文字(无障碍等价),放大二维码窗仍保留(扫码更友好)
  // - 微信号 QR 的"点击复制"行为提示放在 aria-label 中(屏幕阅读器可读,鼠标 hover 不再弹)
  const trigger =
    qr.action === 'copy' ? (
      <button
        type="button"
        onClick={handleCopy}
        className="cursor-pointer transition-opacity hover:opacity-80"
        aria-label={`点击复制微信号: ${qr.copyValue ?? ''}`}
      >
        <div className={QR_BOX}>{img}</div>
      </button>
    ) : (
      <div
        className="cursor-pointer transition-opacity hover:opacity-80"
        aria-label={t(qr.altKey)}
      >
        <div className={QR_BOX}>{img}</div>
      </div>
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
            <Image
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
  const dlg = useDialogSwitch()

  // 2026-08-12 加:Row 1 第一栏底部"代码仓库"小节,平衡左右栏视觉对称
  // (用户反馈"左边底部有点空,跟右侧不太对称,可以再加点什么内容吗 比如仓库地址?一键跳转?")
  // - 复制按钮:点击复制完整仓库地址 + toast 提示
  // - 跳转按钮:外部链接(新窗口打开)
  // - 2026-08-12 加 Gitee/GitCode 国内镜像(用户"再往下加国内的两个镜像仓库")
  // 仓库数据放在组件内常量(非 props,简单场景无需提升到 footer-data.ts)
  const REPOS: ReadonlyArray<{
    key: 'github' | 'gitee' | 'gitcode'
    url: string
    display: string
    nameKey: 'githubRepo' | 'giteeRepo' | 'gitcodeRepo'
    openKey: 'openOnGithub' | 'openOnGitee' | 'openOnGitcode'
    icon: 'github' | 'gitee' | 'gitcode'
  }> = [
    {
      key: 'github',
      url: 'https://github.com/IHUI-INF-AI/IHUI-AI',
      display: 'github.com/IHUI-INF-AI/IHUI-AI',
      nameKey: 'githubRepo',
      openKey: 'openOnGithub',
      icon: 'github',
    },
    {
      key: 'gitee',
      url: 'https://gitee.com/IHUI-INF-AI/IHUI-AI',
      display: 'gitee.com/IHUI-INF-AI/IHUI-AI',
      nameKey: 'giteeRepo',
      openKey: 'openOnGitee',
      icon: 'gitee',
    },
    {
      key: 'gitcode',
      url: 'https://gitcode.com/IHUI-INF-AI/IHUI-AI',
      display: 'gitcode.com/IHUI-INF-AI/IHUI-AI',
      nameKey: 'gitcodeRepo',
      openKey: 'openOnGitcode',
      icon: 'gitcode',
    },
  ]

  // 通用复制函数(支持任意 url + tooltip key)
  const handleCopyUrl = React.useCallback(
    async (url: string) => {
      try {
        await navigator.clipboard.writeText(url)
        toast.success(t('repoCopied'), {
          description: url,
          duration: 3000,
        })
      } catch {
        const ta = document.createElement('textarea')
        ta.value = url
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        try {
          document.execCommand('copy')
          toast.success(t('repoCopied'), {
            description: url,
            duration: 3000,
          })
        } catch {
          toast.error(t('copyFailed'))
        } finally {
          document.body.removeChild(ta)
        }
      }
    },
    [t],
  )

  return (
    // v10 排版(2026-07-30 第七次重构,用户反馈"footer 三个二维码被截断 + 备案图标未显示"):
    // - py-2 min-[768px]:py-3(从 v9 py-0.5 min-[768px]:py-1 拉回,footer 高度 95→~140px,3 个 QR + ICP 图标完全可见)
    // - 内部 gap-1.5(从 v9 gap-0.5 放宽)
    // - icon box h-7 w-7 + QR box h-16 w-16(配合 ICON_BOX/QR_BOX 原子常量)
    // - 备案图标 h-5 w-5(从 h-4 w-4 放大 4px,清晰可见)
    // - 取消 max-w-7xl mx-auto,撑满 w-full,与 page-7 容器左右对齐
    // 2026-08-12 改(用户反馈"Row 2 div 整体下降贴合 footer 底部"):
    // 去掉 footer 底部 padding(py-2 → pt-2 pb-0 / min-[768px]:py-3 → min-[768px]:pt-3 min-[768px]:pb-0),
    // 让 Row 2 容器底边 = footer 容器底边,Row 2 整体下沉贴合 footer 底(之前 footer pb-3=12px
    // 让 Row 2 距 footer 底 12px 间隙,现在消除);顶部 pt-2/pt-3 保留,Row 1 仍有呼吸空。
    <footer
      className={`border-t bg-card/50 px-4 pt-2 pb-0 min-[768px]:px-8 min-[768px]:pt-3 min-[768px]:pb-0${className ? ` ${className}` : ''}`}
    >
      <div className="flex w-full flex-col gap-0">
        {/* Row 1: 3 栏布局(v10 — 2026-07-30 配合 footer 拉高放宽)
            - 栏 1: 公司信息(顶) + 4 个 Dialog 按钮(底) — flex justify-between 消除空白
            - 栏 2: 生态合作 4 类分组 — grid-cols-2 min-[768px]:grid-cols-4 响应式自适应屏幕宽度
            - 栏 3: 官方推广 + QR(不变)
            v10: gap-3(从 v9 gap-1 放大),与 footer 整体拉高对齐 */}
        <div className="grid grid-cols-1 gap-3 min-[768px]:grid-cols-[1fr_1.5fr_1fr] min-[768px]:items-start">
          {/* 栏 1: 公司信息(顶) + 4 个 Dialog 按钮(底)
              - flex flex-col justify-between 让按钮沉底,消除公司信息下方空白
              - 公司信息用 space-y-1,按钮用 flex flex-wrap gap-x-2 gap-y-1 */}
          <div className="flex flex-col justify-between gap-1">
            <div className="space-y-1">
              <h3 className="text-xs font-semibold">{t('companyName')}</h3>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {t('addressLine1')}
                <br />
                {t('addressLine2')}
              </p>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {t('companyContact')}
              </p>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {t('companyEmail')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
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
                {t('userAgreement')}
              </button>
              <button type="button" onClick={() => dlg.open('privacy')} className={FOOTER_BTN}>
                {t('privacyPolicy')}
              </button>
              <button type="button" onClick={() => dlg.open('contact')} className={FOOTER_BTN}>
                {t('contactUs')}
              </button>
            </div>
            {/* 2026-08-12 加:Row 1 栏 1 底部"代码仓库"小节(用户反馈"左边底部有点空,
                跟右侧不太对称,可以再加点什么内容吗 比如仓库地址?一键跳转?")
                - 2026-08-12 扩展:3 个仓库(GitHub + Gitee + GitCode 国内镜像)
                - 视觉:每个仓库一行 = 平台 icon + 仓库地址 + 复制按钮 + 跳转按钮
                - 交互:复制→toast 提示,跳转→新窗口打开
                - 样式:text-[10px] 比 link 区更小,作为辅助信息不抢视觉焦点
                - GitHub/Gitee/GitCode logo 用 inline SVG(lucide-react 不提供品牌图标) */}
            <div className="space-y-0.5 text-[10px] text-muted-foreground/80">
              {REPOS.map((repo) => (
                <div key={repo.key} className="flex items-center gap-1">
                  {repo.icon === 'github' && (
                    <svg
                      className="h-3 w-3 flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                    </svg>
                  )}
                  {repo.icon === 'gitee' && (
                    <svg
                      className="h-3 w-3 flex-shrink-0"
                      viewBox="0 0 1024 1024"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M512 1024C229.222 1024 0 794.778 0 512S229.222 0 512 0s512 229.222 512 512-229.222 512-512 512z m259.148-534.738H394.034l86.546-86.546a23.273 23.273 0 0 0 0-32.92 23.273 23.273 0 0 0-32.92 0l-131.99 131.99a46.546 46.546 0 0 0 0 65.84l131.99 131.99a23.273 23.273 0 1 0 32.92-32.92l-86.546-86.546h377.114a23.273 23.273 0 0 0 0-46.546z" />
                    </svg>
                  )}
                  {repo.icon === 'gitcode' && (
                    <svg
                      className="h-3 w-3 flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M.057 12.035c-.057-.81.034-1.63.196-2.443l.108-.5.107-.5c.092-.43.222-.855.38-1.27.34-.91.81-1.78 1.39-2.59l.21-.29.22-.29c.32-.41.66-.8 1.04-1.17l.25-.25.26-.25c.36-.34.74-.66 1.15-.96l.28-.2.29-.21c.79-.56 1.66-1.04 2.59-1.39.41-.16.84-.29 1.27-.38l.5-.1.5-.11c.81-.16 1.63-.25 2.44-.2.81-.05 1.63.04 2.44.2l.5.11.5.1c.43.09.85.22 1.27.38.93.35 1.8.83 2.59 1.39l.29.21.28.2c.41.3.79.62 1.15.96l.26.25.25.25c.38.37.72.76 1.04 1.17l.22.29.21.29c.58.81 1.05 1.68 1.39 2.59.16.42.29.85.38 1.27l.11.5.1.5c.16.81.26 1.63.2 2.44.06.81-.04 1.63-.2 2.44l-.1.5-.11.5c-.09.43-.22.85-.38 1.27-.34.91-.81 1.78-1.39 2.59l-.21.29-.22.29c-.32.41-.66.8-1.04 1.17l-.25.25-.26.25c-.36.34-.74.66-1.15.96l-.28.2-.29.21c-.79.56-1.66 1.04-2.59 1.39-.42.16-.84.29-1.27.38l-.5.11-.5.1c-.81.16-1.63.26-2.44.2-.81.06-1.63-.04-2.44-.2l-.5-.1-.5-.11c-.43-.09-.85-.22-1.27-.38-.93-.35-1.8-.83-2.59-1.39l-.29-.21-.28-.2c-.41-.3-.79-.62-1.15-.96l-.26-.25-.25-.25c-.38-.37-.72-.76-1.04-1.17l-.22-.29-.21-.29c-.58-.81-1.05-1.68-1.39-2.59-.16-.42-.29-.85-.38-1.27l-.11-.5-.1-.5c-.16-.81-.26-1.63-.2-2.44z M11.83 7.16a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4z" />
                    </svg>
                  )}
                  <code className="truncate font-mono">{repo.display}</code>
                  <Tooltip content={t('copyRepoUrl')}>
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(repo.url)}
                      className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={t('copyRepoUrl')}
                    >
                      <Copy className="h-2.5 w-2.5" />
                    </button>
                  </Tooltip>
                  <Tooltip content={t(repo.openKey)}>
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={t(repo.openKey)}
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </Tooltip>
                </div>
              ))}
            </div>
            {/* 2026-08-12 加:Row 1 栏 1 底部"工作时间"信息(用户反馈"下面还是空,继续优化"),
                进一步平衡栏 1 跟栏 3(官方推广 + 3QR)的高度差
                - Clock icon + 文本,样式与仓库行保持一致(text-[10px])
                - 让栏 1 高度更接近栏 3,缩小左右视觉不对称 */}
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
              <Clock className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              <span>{t('workingHours')}</span>
            </div>
          </div>

          {/* 栏 2: 生态合作 5 类分组(响应式自适应,2026-07-30 v11 拆分大模型为国际/国产 2 组)
              - grid-cols-2(移动端/平板 2 列)+ min-[1024px]:grid-cols-5(桌面 lg+ 5 列 1 行)
              - 1024 边界修复:768-1023px 用 min-[768px]:grid-cols-2 留出更多列宽,避免 5 列过挤图标溢出
              - v10: gap-1(从 v9 gap-0.5 放宽),icons 用 flex flex-wrap gap-1 */}
          <div className="space-y-1">
            <h4 className={SECTION_TITLE}>{t('ecosystem')}</h4>
            <div className="grid grid-cols-2 gap-1 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-5">
              {ECOSYSTEM_GROUPS.map((g) => (
                <div key={g.titleKey} className="space-y-1">
                  <h5 className="text-[11px] font-medium text-foreground/50">{t(g.titleKey)}</h5>
                  <div className="flex flex-wrap gap-1">
                    {g.items.map((p) => (
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
              ))}
            </div>
          </div>

          {/* 栏 3: 官方推广 + QR(v10 配合 footer 拉高)
              - QR h-16 w-16(从 v9 h-12 w-12 放大 16px,3 个 QR 完全可见)
              - gap-2 + pt-1 */}
          <div className="space-y-1">
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
            <div className="flex gap-2 pt-1">
              {QRS.map((q) => (
                <QrItem key={q.src} qr={q} t={t} />
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: ICP + 版权居中(v10 拉高 — 备案图标 h-5 w-5 替代 h-4 w-4 让 16→20px 更清晰)
            - justify-center 居中显示
            - 只保留 ICP 图标 + ICP 文字 + 版权
            2026-08-12 改:Row 2 mt-2 pt-2 → mt-0 pt-1.5(配合外层 gap-0),让 Row 1/Row 2 真正贴合
            (用户反馈"两 div 没挨上")。 */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-0 pt-1.5 text-xs text-muted-foreground">
          <Image
            src="/footer/erweima/footer-icon-1.png"
            alt={t('icp')}
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
            {...IMG_EAGER}
          />
          <Link
            href="/settings/icp-record"
            className="whitespace-nowrap transition-colors hover:text-primary"
          >
            {t('icp')}
          </Link>
          <span className="text-border">·</span>
          <Link
            href="/settings/model-record"
            className="whitespace-nowrap transition-colors hover:text-primary"
          >
            {t('modelRecord')}
          </Link>
          <span className="text-border">·</span>
          <span>{t('copyright')}</span>
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
