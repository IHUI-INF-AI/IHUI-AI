/**
 * ExtensionAuthShell — 扩展端登录外壳(2026-07-26 同步 web 端 LoginDialog 视觉)
 *
 * 视觉规范(完全对齐 apps/web/src/components/auth/AuthShell.tsx):
 *   - 容器:rounded-xl border bg-card p-7 + 双层 subtle 阴影
 *   - 顶部:logo (31×31 rounded-md) + welcome.svg/baiwelcome.svg 浅/深主题并排
 *   - 浅色显示 welcome.svg,深色显示 baiwelcome.svg(由 globals.css .welcome-img/.welcome-img-dark 切换)
 *   - 关闭按钮右上角(onClose 存在时)
 *
 * 与 web 端差异(2026-07-26 立):
 *   - 用 <img> 替代 next/image(扩展环境无 next/image)
 *   - 不引入 next-intl,标题/副标题由调用方传 ReactNode
 *   - 资源走 chrome-extension:// 协议(/images/logo.png 等)
 *
 * 使用场景:
 *   1. sidepanel LoginPage:作为根容器(完整 p-7 + logo+welcome)
 *   2. popup App.tsx 未登录态:作为窄宽弹窗容器(compact=true,缩小 p-5 + 隐藏 welcome)
 */
import type { ReactNode } from 'react'

interface ExtensionAuthShellProps {
  children: ReactNode
  /** 标题(sr-only,视觉由 logo+welcome 表达) */
  title?: string
  /** 副标题(sr-only) */
  subtitle?: ReactNode
  /** 提供 onClose 则显示右上角关闭按钮 */
  onClose?: () => void
  /** 容器 footer(可选,文案居中显示) */
  footer?: ReactNode
  /** 紧凑模式:popup 窄宽(280px),缩小内边距 + 隐藏 welcome,只显示 logo */
  compact?: boolean
  className?: string
}

export function ExtensionAuthShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  compact = false,
  className,
}: ExtensionAuthShellProps) {
  return (
    <div
      className={[
        'login-scope relative w-full rounded-xl border border-border bg-card',
        'shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.04)]',
        compact ? 'p-5' : 'p-7',
        className || '',
      ].join(' ')}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      <div className="flex flex-col items-center text-center">
        {/* 顶部 logo + welcome 并排(仅非 compact 模式)
            - logo 31×31 rounded-md object-contain
            - welcome h-52 w-auto(等比 447×67 → h52 时 w≈347)
            - compact 模式:只显示 logo(弹窗太窄,挤不下 logo+welcome 并排)
        */}
        <div className="flex items-center justify-center gap-3">
          <img
            src="/images/logo.png"
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
                src="/images/welcome.svg"
                alt="Welcome to IHUI AI"
                width={447}
                height={67}
                className="welcome-img absolute inset-0 m-auto h-full w-auto"
                draggable={false}
              />
              <img
                src="/images/baiwelcome.svg"
                alt=""
                aria-hidden
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

      <div className={compact ? 'mt-4' : 'mt-6'}>{children}</div>

      {footer && <div className="mt-5 text-center text-xs text-muted-foreground">{footer}</div>}
    </div>
  )
}

/**
 * 紧凑外壳:用于 popup(280-360px 宽弹窗)
 * 直接透传 ExtensionAuthShell compact=true,提供一致 API 便于未来调整。
 */
export function ExtensionAuthShellCompact(props: ExtensionAuthShellProps) {
  return <ExtensionAuthShell {...props} compact />
}
