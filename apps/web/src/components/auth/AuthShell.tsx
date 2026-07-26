'use client'

/**
 * AuthShell — web 端登录弹窗外壳(2026-07-26 改用共享 @ihui/ui-react.AuthShell)
 *
 * 历史: 此前 web 端有独立 AuthShell 实现,与扩展端 ExtensionAuthShell 各自维护,
 * 样式有肉眼可见差异。2026-07-26 抽取到 packages/ui-react,web + extension 共用
 * 同一份组件 + 同一份 CSS(.login-scope / .welcome-img),真正"一模一样"。
 *
 * 本文件仅做 re-export + 包装,保持 web 端现有 import 路径不变。
 * 扩展端 ExtensionAuthShell.tsx 已删除,扩展端 popup/sidepanel 直接用
 * `@ihui/ui-react` 的 AuthShell / AuthShellCompact。
 */
import * as React from 'react'
import { AuthShell as SharedAuthShell } from '@ihui/ui-react'

interface AuthShellProps {
  title?: string
  subtitle?: React.ReactNode
  onClose?: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

/**
 * 统一弹窗外壳(主站 LoginDialog + /sso/login + /sso/register)
 *
 * 视觉规范由共享包锁定:
 *   - 容器:rounded-xl border bg-card p-7
 *   - 阴影:subtle 双层 0_4px_24px + 0_1px_4px
 *   - 顶部:logo (31×31) + welcome.svg/baiwelcome.svg 浅/深主题并排
 *   - 关闭按钮(右上角,onClose 存在时):lucide-react X
 *   - max-w-[460px](主站宽度上限)
 *   - 标题/副标题 sr-only
 */
export function AuthShell({ className, ...rest }: AuthShellProps) {
  return <SharedAuthShell className={className ?? 'max-w-[460px]'} {...rest} />
}

/**
 * SSO 整页弹窗化包装器:全屏遮罩 + 居中 AuthShell
 *
 * 用途:/sso/login、/sso/register 路由保留,但视觉与主站 LoginDialog 完全一致。
 * 遮罩 bg-black/40 backdrop-blur-[2px](比主站 Dialog 的 bg-black/80 浅,
 * 因 SSO 整页 body 已有 bg-muted/30 背景,过深遮罩会显得突兀)。
 *
 * z-index:z-modal(=2000,引用 --z-modal CSS 变量)。
 *   - 必须高于 AISidePanel 的 z-sticky(=990),否则 SSO 登录遮罩被 AI 面板压在下面,
 *     AI 面板露在遮罩之上 = "AI 对话框跟着登录窗一起变"(2026-07-24 用户反馈回归)。
 *   - 与 globals.css 第 597 行注释"z-modal 用于登录框"规范一致。
 *   - 禁用 z-50(Tailwind 内置=50,低于 z-sticky=990,会复现本 bug)。
 *
 * 点击外部关闭(2026-07-25 立):传 onClose 时,点击遮罩空白处(e.target === e.currentTarget)
 * 触发 onClose(通常是 router.push(redirectUrl) 跳回原页面)。点穿到 AuthShell 子元素不触发,
 * 避免 input/button 误关。与主站 LoginDialog 的 Radix onInteractOutside 行为对齐。
 *
 * 用法:<AuthShellPage onClose={handleClose}><AuthShell onClose={...}>...</AuthShell></AuthShellPage>
 */
export function AuthShellPage({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose?: () => void
}) {
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]"
      onClick={onClose ? (e) => e.target === e.currentTarget && onClose() : undefined}
    >
      {children}
    </div>
  )
}
