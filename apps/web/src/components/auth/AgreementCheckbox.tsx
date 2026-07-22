'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

interface AgreementCheckboxProps {
  checked: boolean
  onChange: (v: boolean) => void
  error?: boolean
}

/**
 * IHUI AI Auth 统一协议复选框(2026-07-22 重构为原生 label>input+span.checkmark 结构)
 * 完全复刻用户提供的 styled-components 样例(24px + ✓ 字符 + 3D 翻转 + #333 黑色)
 * error 态:未选中时边框变 destructive 红
 */
export function AgreementCheckbox({ checked, onChange, error }: AgreementCheckboxProps) {
  const t = useTranslations('auth')
  return (
    <label className="ihui-checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        className="checkmark"
        style={error && !checked ? { borderColor: 'var(--color-destructive)' } : undefined}
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
