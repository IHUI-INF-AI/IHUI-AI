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
    // 注意:此处用 <label> 作为视觉容器但**不关联任何 <input>**。
    // 原因:之前用 <label> 包裹 <span role="checkbox"> + sr-only <input> 模式时,
    // 浏览器在 click 后会通过 label 的 default 行为把焦点转移给 hidden input,
    // 导致用户在密码框外按 Enter 触发的是 input 的 native toggle(取消勾选),
    // 而不是 form submit。
    // 现在让 <label> 自身充当 checkbox(无 labeled control,label 没有 default 行为):
    //   - click label:不转移焦点(label 没有 associated control,label 的 default 行为是 focus/click input,此处不适用)
    //   - Enter on label:onKeyDown 触发 form.requestSubmit() 走 form submit
    //   - a11y:role="checkbox" + aria-checked + tabIndex={0} 由 label 直接提供
    // 配套:内嵌 <a> 链接用 e.stopPropagation() 阻止冒泡到 label.onClick,
    //      避免点击链接时 toggle 复选框。
    <label
      role="checkbox"
      tabIndex={0}
      aria-checked={checked}
      data-testid="agreement-checkbox"
      onClick={(e) => {
        // 阻止内部 <a> 链接冒泡(链接自带 onClick stopPropagation,
        // 这里防御性再处理一次,避免第三方代码改动打破隔离)
        if ((e.target as HTMLElement).closest('a')) return
        e.preventDefault()
        onChange(!checked)
      }}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          // Space:标准 checkbox 切换行为
          e.preventDefault()
          onChange(!checked)
        } else if (e.key === 'Enter') {
          // Enter:提交所在表单(等于点击登录按钮),不 toggle 复选框。
          // 这是用户期望的核心交互:账号/密码填完 + 勾选协议 + Enter 等同点击「登录」按钮。
          e.preventDefault()
          const form = e.currentTarget.closest('form')
          if (form instanceof HTMLFormElement) form.requestSubmit()
        }
      }}
      className={cn(
        'group flex cursor-pointer items-start gap-2 select-none rounded-sm outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          // 2026-08-13 修订:勾选态改为 border-transparent
          // 与共享 Checkbox 保持全局一致(避免 1px 描边感,完全靠 bg-primary 填充提供视觉边界)
          'mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-all duration-200',
          error
            ? 'border-destructive'
            : checked
              ? 'border-transparent bg-primary text-primary-foreground'
              : 'border-input bg-background group-hover:border-foreground/60',
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
      </span>
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
