/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return <></>

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
      onKeyDown={(e) => e.key === 'Escape' && onClose?.()}
      tabIndex={-1}
    >
      <div
        className={cn(
          'relative w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl',
          className,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
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
