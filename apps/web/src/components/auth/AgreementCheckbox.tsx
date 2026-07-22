'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface AgreementCheckboxProps {
  checked: boolean
  onChange: (v: boolean) => void
  error?: boolean
}

/**
 * IHUI AI Auth 统一协议复选框(2026-07-20 立)
 *
 * 替代 LoginFormContent / RegisterFormContent 里两份重复实现。
 * - 16x16 方形 rounded(4px) 边框,hover 描边加深 + 轻微放大,选中 3D 翻转动画
 * - 复用 .ihui-checkbox 全局样式类(globals.css),与 packages/ui Checkbox 视觉一致
 * - 文字部分:前缀 + 蓝色链接(用户协议、隐私政策),target="_blank"
 * - 视觉规范符合 §4 极简扁平
 * - 完整 a11y:role="checkbox" + aria-checked + tabIndex + onKeyDown(Space/Enter) + 内嵌 sr-only input
 */
export function AgreementCheckbox({ checked, onChange, error }: AgreementCheckboxProps) {
  const t = useTranslations('auth')
  return (
    <label className="group flex cursor-pointer items-start gap-2 select-none">
      <span
        onClick={(e) => {
          e.preventDefault()
          onChange(!checked)
        }}
        className={[
          'ihui-checkbox mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded border',
          error && !checked ? 'border-destructive' : 'border-input',
        ].join(' ')}
        data-state={checked ? 'checked' : 'unchecked'}
        aria-checked={checked}
        role="checkbox"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            onChange(!checked)
          }
        }}
      >
        {checked && <Check className="ihui-checkbox-indicator h-3 w-3" strokeWidth={3} />}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        tabIndex={-1}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
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
