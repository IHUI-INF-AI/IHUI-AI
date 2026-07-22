'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, X } from 'lucide-react'

import { Input } from '@ihui/ui'
import {
  loadLoginHistory,
  removeFromLoginHistory,
  clearLoginHistory,
} from '@/lib/remember-credentials'

interface AccountHistoryInputProps {
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
  /** disabled */
  disabled?: boolean
  /** aria-label */
  ariaLabel?: string
}

/**
 * 账号输入框 + 历史下拉菜单(共享组件)。
 *
 * 三个登录表单(密码 / 邮箱验证码 / 手机验证码)共用,行为一致:
 * - 双击输入框或点击右侧 ChevronDown 展开历史
 * - 键盘 ArrowUp/Down 导航,Enter 选中,Escape 关闭
 * - 单条删除(X 按钮)+ 清空全部
 * - 下拉打开时实时读取 localStorage,保证登录成功后下次打开即最新
 *
 * 保存历史由各表单在登录成功后自行调用 saveLoginHistory。
 */
export function AccountHistoryInput({
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
}: AccountHistoryInputProps) {
  const t = useTranslations('auth')
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

  const toggleHistory = () => {
    setShowHistory((v) => {
      if (!v) setActiveHistoryIndex(-1)
      return !v
    })
  }

  return (
    <div className="relative" data-account-history-container>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={className}
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
            e.preventDefault()
            const selected = loginHistory[activeHistoryIndex]
            if (selected) selectAccount(selected)
          } else if (e.key === 'Escape') {
            setShowHistory(false)
            setActiveHistoryIndex(-1)
          }
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={toggleHistory}
        className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label={t('accountHistory')}
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${showHistory ? 'rotate-180' : ''}`}
        />
      </button>
      {showHistory && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-md">
          {loginHistory.length > 0 ? (
            <>
              {loginHistory.map((account, idx) => (
                <div
                  key={account}
                  data-history-index={idx}
                  onMouseEnter={() => setActiveHistoryIndex(idx)}
                  onClick={() => selectAccount(account)}
                  className={[
                    'flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors',
                    activeHistoryIndex === idx
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground',
                  ].join(' ')}
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
                    aria-label={t('removeAccount')}
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
                {t('clearHistory')}
              </button>
            </>
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">{t('noHistory')}</div>
          )}
        </div>
      )}
    </div>
  )
}
