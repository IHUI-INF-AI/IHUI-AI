'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Checkbox } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface AgreementCheckboxProps {
  checked: boolean
  onChange: (v: boolean) => void
  error?: boolean
}

/**
 * IHUI AI Auth 统一协议复选框(2026-07-20 立)
 *
 * 替代 LoginFormContent / RegisterFormContent 里两份重复实现。
 * 基于 @ihui/ui 的 Radix Checkbox primitive,获得:
 *   - 原生 role="checkbox" + aria-checked
 *   - 键盘 Space/Enter 切换(无需手写 onKeyDown)
 *   - focus-visible 环
 *
 * 视觉规范(保留原极简扁平风格):
 *   - 16x16 方形 rounded-[4px],空白态 border-input,hover 描边加深
 *   - 勾选态 border-primary + bg-primary + text-primary-foreground
 *   - 错误态 border-destructive
 */
export function AgreementCheckbox({ checked, onChange, error }: AgreementCheckboxProps) {
  const t = useTranslations('auth')
  return (
    <label className="group flex cursor-pointer items-start gap-2 select-none">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className={cn(
          'mt-[1px] rounded-[4px] border-input shadow-none group-hover:border-foreground/60 data-[state=checked]:border-primary',
          error && 'border-destructive group-hover:border-destructive',
        )}
      />
      <span className="text-xs leading-5 text-muted-foreground">
        {t('agreePrefix')}
        <Link
          href="/agreement/user-agreement"
          target="_blank"
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {t('termsOfService')}
        </Link>
        {t('and')}
        <Link
          href="/agreement/privacy-policy"
          target="_blank"
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {t('privacyPolicy')}
        </Link>
      </span>
    </label>
  )
}
