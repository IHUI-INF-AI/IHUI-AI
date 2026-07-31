'use client'

import * as React from 'react'
import { X } from 'lucide-react'

import { Input } from '../input'
import { cn } from '../../lib/utils'
import {
  loadLoginHistory,
  removeFromLoginHistory,
  clearLoginHistory,
} from '../../lib/remember-credentials'

export interface AccountHistoryInputProps {
  /** i18n 翻译函数(由调用方注入,适配 web next-intl / 扩展自实现) */
  t: (key: string, params?: Record<string, string | number>) => string
  id?: string
  type?: string
  autoComplete?: string
  placeholder?: string
  className?: string
  value: string
  onChange: (v: string) => void
  /** 选中历史项时回调(密码登录用来同步填充密码) */
  onSelect?: (v: string) => void
  /** 外部 ref(需要聚焦输入框时传入) */
  inputRef?: React.Ref<HTMLInputElement>
  /** 表单是否激活(激活/切回 tab 时重新读取历史) */
  active?: boolean
  disabled?: boolean
  ariaLabel?: string
  inputClassName?: string
}

/**
 * 账号输入框 + 历史下拉菜单(2026-07-30 抽到共享包,2026-07-31 移除 ChevronDown 按钮)
 *
 * 从 apps/web/src/components/login/AccountHistoryInput.tsx 抽取,
 * 消除 web 端 B 版本 PasswordLoginForm 与共享包 A 版本 password-login-form
 * 的功能差异(历史下拉在 2026-07-26 抽共享包时丢失)。
 *
 * 行为(2026-07-31 更新):
 * - 双击输入框展开历史(移除右侧 ChevronDown 按钮,符合用户偏好"不显示非必要 chevron")
 * - 键盘 ArrowUp/Down 导航,Enter 选中,Escape 关闭
 * - 单条删除(X 按钮)+ 清空全部
 * - 下拉打开时实时读取 localStorage,保证登录成功后下次打开即最新
 *
 * 共享包关键差异(2026-07-30):
 *   - i18n 函数由调用方注入(适配 web next-intl / 扩展自实现)
 *   - 直接 import 共享包 lib/remember-credentials(不依赖 web 端 @/lib/...)
 *   - 不依赖 next-intl
 */
export function AccountHistoryInput({
  t,
  id,
  type = 'text',
  autoComplete,
  placeholder,
  className,
  value,
  onChange,
  onSelect,
  inputRef,
  active = true,
  disabled,
  ariaLabel,
  inputClassName,
}: AccountHistoryInputProps) {
  const [showHistory, setShowHistory] = React.useState(false)
  const [loginHistory, setLoginHistory] = React.useState<string[]>(() => loadLoginHistory())
  const [activeHistoryIndex, setActiveHistoryIndex] = React.useState(-1)
  const innerRef = React.useRef<HTMLInputElement | null>(null)

  // 表单激活时重新读取历史(切 tab 回来时刷新)
  React.useEffect(() => {
    if (active) setLoginHistory(loadLoginHistory())
  }, [active])

  // 下拉打开时实时读取历史(保证登录成功后下次打开即最新)
  React.useEffect(() => {
    if (showHistory) setLoginHistory(loadLoginHistory())
  }, [showHistory])

  // 点击外部关闭历史下拉
  React.useEffect(() => {
    if (!showHistory) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-account-history-container]')) {
        setShowHistory(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showHistory])

  const selectAccount = (account: string) => {
    onChange(account)
    onSelect?.(account)
    setShowHistory(false)
    setActiveHistoryIndex(-1)
    innerRef.current?.focus()
  }

  // 2026-07-31:移除 ChevronDown 按钮后,toggleHistory 仅在双击时调用
  const toggleHistory = React.useCallback(() => {
    setShowHistory((v) => {
      if (!v) setActiveHistoryIndex(-1)
      return !v
    })
  }, [])

  return (
    <div
      className={cn('relative', className)}
      data-account-history-container
      data-testid="account-history-input"
    >
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={inputClassName}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        ref={(el) => {
          innerRef.current = el
          if (typeof inputRef === 'function') inputRef(el)
          else if (inputRef)
            (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el
        }}
        onDoubleClick={(e) => {
          e.preventDefault()
          toggleHistory()
        }}
        onKeyDown={(e) => {
          if (!showHistory || loginHistory.length === 0) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveHistoryIndex((i) => (i + 1) % loginHistory.length)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveHistoryIndex((i) => (i - 1 + loginHistory.length) % loginHistory.length)
          } else if (e.key === 'Enter' && activeHistoryIndex >= 0) {
            // 历史下拉打开 + 有高亮项时,Enter 选中账号(不触发 form submit)
            e.preventDefault()
            e.stopPropagation()
            const selected = loginHistory[activeHistoryIndex]
            if (selected) selectAccount(selected)
          } else if (e.key === 'Escape') {
            setShowHistory(false)
            setActiveHistoryIndex(-1)
          }
        }}
      />
      {/*
        2026-07-31 修复:移除右侧 ChevronDown 按钮(用户偏好"不显示非必要 chevron",
        与 user profile 中"dislikes chevron arrows for user info containers when functionality is obvious" 一致)。
        保留双击输入框 + 键盘 ArrowDown 的展开方式,功能不变。
        历史账号可在输入框获得焦点后双击展开,或键入字符时按 ArrowDown 打开。
      */}
      {showHistory && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-md">
          {loginHistory.length > 0 ? (
            <>
              {loginHistory.map((account, idx) => (
                <div
                  key={account}
                  role="button"
                  tabIndex={0}
                  data-history-index={idx}
                  onMouseEnter={() => setActiveHistoryIndex(idx)}
                  onClick={() => selectAccount(account)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      selectAccount(account)
                    }
                  }}
                  className={cn(
                    'flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors',
                    activeHistoryIndex === idx
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <span className="truncate">{account}</span>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation()
                      setLoginHistory(removeFromLoginHistory(account))
                      if (loginHistory.length <= 1) setShowHistory(false)
                    }}
                    className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t('auth.removeAccount')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                tabIndex={-1}
                onClick={() => {
                  clearLoginHistory()
                  setLoginHistory([])
                  setShowHistory(false)
                  setActiveHistoryIndex(-1)
                }}
                className="mt-1 w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {t('auth.clearHistory')}
              </button>
            </>
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">{t('auth.noHistory')}</div>
          )}
        </div>
      )}
    </div>
  )
}
