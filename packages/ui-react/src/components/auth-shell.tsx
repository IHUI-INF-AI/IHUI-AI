/**
 * AuthShell — IHUI AI 统一登录弹窗外壳(2026-07-26 抽取到共享包)
 *
 * 历史: 此前 web 端 apps/web/src/components/auth/AuthShell.tsx 与扩展端
 * apps/extension/entrypoints/components/ExtensionAuthShell.tsx 各有一份,
 * 视觉规范一致但实现细节有差异(关闭按钮位置 right-3/4、compact 模式、
 * next/image vs <img> 等),两端肉眼可见不一致。
 *
 * 本组件为单一来源(single source of truth),web + extension 端都用它,
 * 样式(.login-scope / .welcome-img)在 packages/ui-react/src/styles/auth-shell.css
 * 集中定义,两边 @import 引用 → 真正"一模一样"。
 *
 * 视觉规范(2026-07-26 锁定):
 *   - 容器:rounded-xl border border-border bg-card p-7(compact: p-5)
 *   - 阴影:subtle 双层 0_4px_24px + 0_1px_4px
 *   - 顶部:logo (31×31 rounded-md) + welcome.svg/baiwelcome.svg 浅/深主题并排
 *   - 关闭按钮(右上角,onClose 存在时):lucide-react X 图标
 *   - 标题/副标题 sr-only(仅给 a11y 读屏用,视觉由 logo+welcome 表达)
 *   - max-w: 默认 460px(popup 紧凑模式可不传,父容器限制宽度)
 *
 * 平台差异由调用方传 props 控制:
 *   - logoSrc / welcomeLightSrc / welcomeDarkSrc:不同环境路径不同(web 用 /images/...,扩展用 chrome-extension://.../images/...)
 *   - closeAriaLabel:不同语言(默认 "Close")
 *   - compact:popup 窄宽模式(p-5 + 不渲染 welcome)
 *   - className:外部传 max-w-[420px] 等
 */
import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '../lib/utils'

export interface AuthShellProps {
  /** 标题(sr-only,视觉由 logo+welcome 表达) */
  title?: string
  /** 副标题(sr-only) */
  subtitle?: React.ReactNode
  /** 提供 onClose 则显示右上角关闭按钮 */
  onClose?: () => void
  /** 关闭按钮 aria-label(默认 "Close") */
  closeAriaLabel?: string
  children: React.ReactNode
  /** 容器 footer(可选,文案居中显示) */
  footer?: React.ReactNode
  /** 紧凑模式:popup 窄宽(280-360px),缩小内边距 + 隐藏 welcome,只显示 logo */
  compact?: boolean
  className?: string
  /** logo 图片 src,默认 '/images/logo.png'(web 公共路径) */
  logoSrc?: string
  /** 浅色 welcome 图 src,默认 '/images/welcome.svg' */
  welcomeLightSrc?: string
  /** 深色 welcome 图 src,默认 '/images/baiwelcome.svg' */
  welcomeDarkSrc?: string
}

const DEFAULT_LOGO = '/images/logo.png'
const DEFAULT_WELCOME_LIGHT = '/images/welcome.svg'
const DEFAULT_WELCOME_DARK = '/images/baiwelcome.svg'

export function AuthShell({
  title,
  subtitle,
  onClose,
  closeAriaLabel = 'Close',
  children,
  footer,
  compact = false,
  className,
  logoSrc = DEFAULT_LOGO,
  welcomeLightSrc = DEFAULT_WELCOME_LIGHT,
  welcomeDarkSrc = DEFAULT_WELCOME_DARK,
}: AuthShellProps) {
  return (
    <div
      className={cn(
        'login-scope relative w-full rounded-xl border border-border bg-card',
        'shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.04)]',
        compact ? 'p-5' : 'p-7',
        className,
      )}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeAriaLabel}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="flex flex-col items-center text-center">
        {/* 顶部 logo + welcome 左右并排(复用 M-66/M-68/M-69 视觉方案,2026-07-20 恢复;2026-07-20 修 w-full 塌陷 + logo 统一 + logo 高度对齐 welcome 文字)
            - logo 31×31 rounded-md object-contain + inline style translateY(2px),统一用 /images/logo.png(共享包默认)
            - welcome h-[52px] w-auto 等比缩放(原 447×67 → h52 时 w≈347)
            - gap-3(12px)间距
            - 浅色 welcome.svg / 深色 baiwelcome.svg 由 .login-scope styles/auth-shell.css .welcome-img/.welcome-img-dark 切换 */}
        <div className="flex items-center justify-center gap-3">
          <img
            src={logoSrc}
            alt="IHUI AI"
            width={31}
            height={31}
            className="h-[31px] w-[31px] shrink-0 select-none rounded-md object-contain"
            style={{ transform: 'translateY(2px)' }}
            draggable={false}
          />
          {!compact && (
            <div className="relative h-[52px] w-[340px] shrink-0">
              <img
                src={welcomeLightSrc}
                alt="Welcome to IHUI AI"
                width={447}
                height={67}
                className="welcome-img absolute inset-0 m-auto h-full w-auto"
                draggable={false}
              />
              <img
                src={welcomeDarkSrc}
                alt=""
                aria-hidden="true"
                width={447}
                height={67}
                className="welcome-img-dark absolute inset-0 m-auto h-full w-auto"
                draggable={false}
              />
            </div>
          )}
        </div>
        {title && <h1 className="sr-only">{title}</h1>}
        {subtitle && <p className="sr-only">{subtitle}</p>}
      </div>

      <div className={cn(compact ? 'mt-4' : 'mt-6')}>{children}</div>

      {footer && <div className="mt-5 text-center text-xs text-muted-foreground">{footer}</div>}
    </div>
  )
}

/**
 * 紧凑外壳:用于 popup(280-360px 宽弹窗)
 * 直接透传 AuthShell compact=true,提供一致 API 便于未来调整。
 */
export function AuthShellCompact(props: AuthShellProps) {
  return <AuthShell {...props} compact />
}
