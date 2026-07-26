/**
 * Alert — 共享错误提示组件(2026-07-26 立)
 *
 * 共享包不直接依赖 web 端 @/components/feedback/Alert(避免跨包依赖)。
 * 本组件提供跟 web 端 Alert variant=danger 视觉一致的错误提示。
 *
 * 样式集中在 packages/ui-react/src/styles/login-form.css 的 .lf-alert 系列。
 */
import * as React from 'react'

interface AlertProps {
  /** variant: 'danger' 红色错误;'warning' 黄色警告;默认 danger */
  variant?: 'danger' | 'warning'
  description: string
}

const VARIANT_ICON: Record<NonNullable<AlertProps['variant']>, string> = {
  danger: '⚠',
  warning: '⚠',
}

const VARIANT_STYLE: Record<NonNullable<AlertProps['variant']>, React.CSSProperties> = {
  danger: {
    borderColor: 'hsl(0 84% 60% / 0.3)',
    backgroundColor: 'hsl(0 84% 60% / 0.05)',
    color: 'hsl(0 84% 60%)',
  },
  warning: {
    borderColor: 'hsl(38 92% 50% / 0.3)',
    backgroundColor: 'hsl(38 92% 50% / 0.05)',
    color: 'hsl(38 92% 50%)',
  },
}

export function Alert({ variant = 'danger', description }: AlertProps) {
  return (
    <div
      role="alert"
      className="lf-alert"
      style={VARIANT_STYLE[variant]}
      data-testid="login-form-alert"
    >
      <span className="lf-alert-icon" aria-hidden="true">
        {VARIANT_ICON[variant]}
      </span>
      <span className="lf-alert-text">{description}</span>
    </div>
  )
}
