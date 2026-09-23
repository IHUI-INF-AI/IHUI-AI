// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable jsx-a11y/no-noninteractive-element-interactions -- 模态弹层用 div+onClick 实现遮罩;键盘用户通过关闭按钮(X)提供等价交互 */
'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CloseButton } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { isTopOverlay, popOverlay, pushOverlay } from '@/lib/overlay-stack'

/** 层栈 id(见 @/lib/overlay-stack):登录弹窗的 Esc 只在栈顶时被消费 */
const LOGIN_POPUP_OVERLAY_ID = 'login-popup'

export interface LoginPopupProps {
  open: boolean
  onClose?: () => void
  onLogin?: (method: 'phone' | 'email' | 'wechat') => void
  title?: string
  className?: string
  children?: React.ReactNode
}

export default function LoginPopup({
  open,
  onClose,
  onLogin,
  title = '登录以继续',
  className,
  children,
}: LoginPopupProps): React.JSX.Element {
  const t = useTranslations('a11y')
  // 层栈注册:open → 入栈(成为栈顶);close/unmount → 出栈。
  React.useEffect(() => {
    if (!open) return
    pushOverlay(LOGIN_POPUP_OVERLAY_ID)
    return () => popOverlay(LOGIN_POPUP_OVERLAY_ID)
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 只让栈顶那一层消费 Esc:多层同时打开时,一次 Esc 关最上层
        if (!isTopOverlay(LOGIN_POPUP_OVERLAY_ID)) return
        onClose?.()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return <></>

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-3"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && isTopOverlay(LOGIN_POPUP_OVERLAY_ID)) onClose?.()
      }}
      tabIndex={-1}
    >
      <div
        className={cn(
          'login-scope relative w-full max-w-sm rounded-2xl bg-background p-3 shadow-xl',
          className,
        )}
      >
        {/* 2026-09-16 全项目统一关闭按钮 token:CloseButton(ui-react),样式源自 @ihui/design-tokens */}
        <CloseButton floating aria-label={t('close')} onClick={onClose} />
        <h2 className="mb-4 text-center text-lg font-semibold">{title}</h2>
        {children ? (
          children
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onLogin?.('phone')}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              手机号登录
            </button>
            <button
              type="button"
              onClick={() => onLogin?.('email')}
              className="w-full rounded-md border px-4 py-2.5 text-sm hover:bg-muted"
            >
              邮箱登录
            </button>
            <button
              type="button"
              onClick={() => onLogin?.('wechat')}
              className="w-full rounded-md border px-4 py-2.5 text-sm hover:bg-muted"
            >
              微信登录
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
