'use client'

import { Check } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface AgreementCheckboxProps {
  /** i18n 翻译函数 */
  t: (key: string, params?: Record<string, string | number>) => string
  checked: boolean
  onChange: (v: boolean) => void
  error?: boolean
  /** 用户协议链接,默认 /agreement/user-agreement */
  termsHref?: string
  /** 隐私政策链接,默认 /agreement/privacy-policy */
  privacyHref?: string
  className?: string
}

/**
 * 协议复选框(2026-07-26 抽取到共享包)
 *
 * 视觉规范(对标 apps/web/src/components/auth/AgreementCheckbox.tsx):
 *   - 16x16 方形 rounded-[4px] 边框,hover 描边加深,勾选用 Check 图标(strokeWidth=3)
 *   - 文字部分:前缀 + 主色链接(用户协议、隐私政策),target="_blank"
 *   - 完整 a11y:role="checkbox" + aria-checked + tabIndex + onKeyDown(Space/Enter) + 内嵌 sr-only input
 *
 * 共享包关键差异(2026-07-26):**不依赖 next/link**,改用普通 <a> target="_blank"
 * rel="noopener noreferrer",这样能在 extension popup/sidepanel 中工作
 * (next/link 在扩展端会出错)。调用方可通过 termsHref/privacyHref 自定义路径。
 */
export function AgreementCheckbox({
  t,
  checked,
  onChange,
  error,
  termsHref = '/agreement/user-agreement',
  privacyHref = '/agreement/privacy-policy',
  className,
}: AgreementCheckboxProps) {
  return (
    <label className={cn('group flex cursor-pointer items-start gap-2 select-none', className)}>
      <span
        onClick={(e) => {
          e.preventDefault()
          onChange(!checked)
        }}
        className={cn(
          'mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-all duration-200',
          error
            ? 'border-destructive'
            : checked
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background group-hover:border-foreground/60',
        )}
        aria-checked={checked}
        role="checkbox"
        tabIndex={0}
        data-testid="agreement-checkbox"
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            onChange(!checked)
          }
        }}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        tabIndex={-1}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-hidden="true"
      />
      <span className="text-xs leading-5 text-muted-foreground">
        {t('auth.agreePrefix')}
        <a
          href={termsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {t('auth.termsOfService')}
        </a>
        {t('auth.and')}
        <a
          href={privacyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {t('auth.privacyPolicy')}
        </a>
      </span>
    </label>
  )
}
