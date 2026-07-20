'use client'

import * as React from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuthShellProps {
  /** 标题(sr-only,视觉由 logo+welcome 表达,仅给 a11y 读屏用) */
  title?: string
  /** 副标题(sr-only,视觉由 logo+welcome 表达,仅给 a11y 读屏用) */
  subtitle?: React.ReactNode
  /** 提供 onClose 则显示右上角关闭按钮 */
  onClose?: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

/**
 * IHUI AI Auth 统一弹窗外壳(2026-07-20 立 / 2026-07-20 修订)
 *
 * 视觉规范:
 *   - 容器:max-w-[460px] rounded-xl border bg-card p-7
 *   - 阴影:subtle 双层 0_4px_24px + 0_1px_4px(符合 §4 极简扁平 + subtle 阴影)
 *   - 顶部:logo(52×52 rounded-xl)+ welcome.svg/baiwelcome.svg(浅/深主题切换)左右并排
 *     · 复用 M-66/M-68/M-69 视觉方案:logo 52 + gap-3 + welcome h-52 等比 w-auto
 *     · 浅色 welcome.svg / 深色 baiwelcome.svg,globals.css .welcome-img/.welcome-img-dark 切换
 *     · 标题(text-xl)+ 副标题(text-xs)在并排下方
 *   - 关闭:右上角 X 按钮(onClose 存在时渲染)
 *
 * 使用场景:
 *   1. 主站 LoginDialog:作为 DialogContent 的直接子元素
 *   2. SSO /sso/login、/sso/register 整页:用 AuthShellPage 包裹(全屏遮罩 + 居中)
 *
 * 历史说明:M-66~M-69 的 logo+welcome 并排方案曾在 ce7d076c 被取消(改单 logo 极简版),
 * 2026-07-20 经用户确认 3 处(主站弹窗 + /sso/login + /sso/register)全恢复并排显示。
 */
export function AuthShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  className,
}: AuthShellProps) {
  const t = useTranslations('a11y')
  return (
    <div
      className={cn(
        'relative w-full max-w-[460px] rounded-xl border border-border bg-card p-7',
        'shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.04)]',
        className,
      )}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="flex flex-col items-center text-center">
        {/* 顶部 logo + welcome 左右并排(复用 M-66/M-68/M-69 视觉方案,2026-07-20 恢复;2026-07-20 修 w-full 塌陷 + logo 统一 + logo 高度对齐 welcome 文字)
            - logo 31×31 rounded-md object-contain + inline style translateY(2px),统一用 /images/logo.png?v=20260719-unify(全站 9 处一致)
              第 8 次调整:用户反馈 30 稍小,+1 到 31px。translate 仍用 inline style(避免 Tailwind translate-y 编译 bug)。
            - welcome h-[52px] w-auto 等比缩放(原 447×67 → h52 时 w≈347)
            - gap-3(12px)间距,31+12+340=383 ≤ 内宽 404(p-7 28×2 + max-w-460),余 21px 由 flex justify-center 自动居中
            - welcome 容器固定 w-[340px] + shrink-0:flex 子元素 w-full 在 shrink-to-fit 容器里会塌陷为 0,
              且 absolute Image 无 in-flow 内容,父容器直接缩成 0 → welcome 不显示。固定宽度修复。
            - 浅色 welcome.svg / 深色 baiwelcome.svg 由 globals.css .welcome-img/.welcome-img-dark 切换 */}
        <div className="flex items-center justify-center gap-3">
          <Image
            src="/images/logo.png?v=20260719-unify"
            alt="IHUI AI"
            width={31}
            height={31}
            className="h-[31px] w-[31px] shrink-0 select-none rounded-md object-contain"
            style={{ transform: 'translateY(2px)' }}
            draggable={false}
            priority
          />
          <div className="relative h-[52px] w-[340px] shrink-0">
            <Image
              src="/images/welcome.svg"
              alt="Welcome to IHUI AI"
              width={447}
              height={67}
              className="welcome-img absolute inset-0 m-auto h-full w-auto"
              loading="eager"
              unoptimized
            />
            <Image
              src="/images/baiwelcome.svg"
              alt=""
              aria-hidden="true"
              width={447}
              height={67}
              className="welcome-img-dark absolute inset-0 m-auto h-full w-auto"
              loading="eager"
              unoptimized
            />
          </div>
        </div>
        {/* 标题/副标题 sr-only:视觉由 logo + welcome 并排表达(2026-07-20 修订)
            - 主站 LoginDialog 已有 sr-only DialogTitle/DialogDescription,不传 title/subtitle
            - SSO 整页传 title/subtitle,此处 sr-only h1/p 承担 a11y 读屏角色
            - 视觉统一:3 处都只有 logo + welcome + 表单,无"欢迎回来 登录您的账号"文字 */}
        {title && <h1 className="sr-only">{title}</h1>}
        {subtitle && <p className="sr-only">{subtitle}</p>}
      </div>

      <div className="mt-6">{children}</div>

      {footer && <div className="mt-5 text-center text-xs text-muted-foreground">{footer}</div>}
    </div>
  )
}

/**
 * SSO 整页弹窗化包装器:全屏遮罩 + 居中 AuthShell
 *
 * 用途:/sso/login、/sso/register 路由保留,但视觉与主站 LoginDialog 完全一致。
 * 遮罩 bg-black/40 backdrop-blur-[2px](比主站 Dialog 的 bg-black/80 浅,
 * 因 SSO 整页 body 已有 bg-muted/30 背景,过深遮罩会显得突兀)。
 *
 * 用法:<AuthShellPage><AuthShell onClose={...}>...</AuthShell></AuthShellPage>
 */
export function AuthShellPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]">
      {children}
    </div>
  )
}
