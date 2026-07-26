/**
 * AgreementCheckbox — 共享协议复选框(2026-07-26 立)
 *
 * 抽到 packages/ui-react,web + extension 共用同一份组件。
 * 视觉规范(对齐 web 端原 AgreementCheckbox 2026-07-20 实现):
 *   - 16x16 方形 rounded-[4px] 边框
 *   - hover 描边加深,勾选用 Check 图标(strokeWidth=3)
 *   - 文字部分:前缀 + 蓝色链接(用户协议、隐私政策),target="_blank"
 *   - 完整 a11y:role="checkbox" + aria-checked + tabIndex + onKeyDown(Space/Enter) + 内嵌 sr-only input
 *
 * 共享包不依赖 next/link,扩展端在 service worker / popup / sidepanel 三种环境
 * 下都没有 next 路由,直接用 <a target="_blank"> 即可。
 */
import { Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TFunc } from './types'

interface AgreementCheckboxProps {
  checked: boolean
  onChange: (v: boolean) => void
  error?: boolean
  /** i18n 函数 */
  t: TFunc
  /** 用户协议链接,默认 '/agreement/user-agreement'(web 端路径) */
  termsHref?: string
  /** 隐私政策链接,默认 '/agreement/privacy-policy' */
  privacyHref?: string
}

export function AgreementCheckbox({
  checked,
  onChange,
  error,
  t,
  termsHref = '/agreement/user-agreement',
  privacyHref = '/agreement/privacy-policy',
}: AgreementCheckboxProps) {
  return (
    <label className="group flex cursor-pointer items-start gap-2 select-none">
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
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            onChange(!checked)
          }
        }}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        tabIndex={-1}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
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
