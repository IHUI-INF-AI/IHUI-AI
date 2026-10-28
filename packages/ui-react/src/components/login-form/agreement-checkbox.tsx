// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
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
  const labelId = React.useId()
  return (
    // 2026-09-22 非法嵌套根治:原 <label role="checkbox" tabIndex={0}> 把"勾选控件"的语义压在
    // 整块文字上,内部两枚 <a href> 遂成 interactive-in-interactive,且 role=checkbox 缺 aria-checked
    // 之外的名字。现按 apps/web 版同口径把 role/aria-checked/tabIndex 下放到真正表示勾选框的内层
    // span,外层 <label> 只留点击代理职责(不再有任何 role/tabIndex)。
    // 点文字切换勾选走 label ↔ sr-only input 的原生关联(不再靠 stopPropagation 维持正确性);
    // 两枚 <a> 因是 label 的 interactive content 后代,浏览器本就不会把点击转发给控件。
    <label
      data-testid="agreement-checkbox"
      className={cn(
        'group flex cursor-pointer items-start gap-2 select-none rounded-sm',
        className,
      )}
    >
      <span
        role="checkbox"
        aria-checked={checked}
        aria-labelledby={labelId}
        tabIndex={0}
        data-testid="agreement-checkbox-box"
        onClick={(e) => {
          // preventDefault 掐掉 label 的默认转发(否则 sr-only input 会被再点一次 → 双切换),
          // 同时避免焦点被交给隐藏 input(历史回归:焦点落在 input 上后在别处按 Enter
          // 触发的是 input 的 native toggle,而不是 form submit)。
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
          'mt-[1px] flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border outline-none transition-all duration-200',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          // 2026-08-13 修订:勾选态改为 border-transparent
          // 与共享 Checkbox 保持全局一致(避免 1px 描边感,完全靠 bg-primary 填充提供视觉边界)
          error
            ? 'border-destructive'
            : checked
              ? 'border-transparent bg-cta text-cta-foreground'
              : 'border-input bg-background group-hover:border-foreground/60',
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
      </span>
      {/* 真实可标记控件:承载 label 的点击代理与 accessible name 计算,不参与 Tab 序列 */}
      <input
        type="checkbox"
        className="sr-only"
        tabIndex={-1}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span id={labelId} className="text-xs leading-5 text-muted-foreground">
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
