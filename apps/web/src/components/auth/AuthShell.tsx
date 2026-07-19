'use client'

import * as React from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuthShellProps {
  title: string
  subtitle?: React.ReactNode
  /** 提供 onClose 则显示右上角关闭按钮 */
  onClose?: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

/**
 * IHUI AI Auth 统一弹窗外壳(2026-07-20 立)
 *
 * 视觉规范:
 *   - 容器:max-w-[420px] rounded-xl border bg-card p-7
 *   - 阴影:subtle 双层 0_4px_24px + 0_1px_4px(符合 §4 极简扁平 + subtle 阴影)
 *   - 顶部:单个 logo 图标(44x44 rounded-xl)+ 标题(text-xl)+ 副标题(text-xs)
 *   - 关闭:右上角 X 按钮(onClose 存在时渲染)
 *
 * 使用场景:
 *   1. 主站 LoginDialog:作为 DialogContent 的直接子元素
 *   2. SSO /sso/login、/sso/register 整页:用 AuthShellPage 包裹(全屏遮罩 + 居中)
 *
 * 设计原则:取消 M-66/M-67/M-68/M-69 那套 logo+welcome 双图叠加技术债,
 * 改为单个 logo + 标题 + 副标题的极简结构,主站弹窗与 SSO 整页视觉完全统一。
 */
export function AuthShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  className,
}: AuthShellProps) {
  return (
    <div
      className={cn(
        'relative w-full max-w-[420px] rounded-xl border border-border bg-card p-7',
        'shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.04)]',
        className,
      )}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="flex flex-col items-center text-center">
        <Image
          src="/images/logo-icon.svg?v=20260719-icon-restore-v1"
          alt="IHUI AI"
          width={44}
          height={44}
          className="h-11 w-11 rounded-xl select-none"
          draggable={false}
          unoptimized
          priority
        />
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1.5 text-xs text-muted-foreground">{subtitle}</p>}
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
