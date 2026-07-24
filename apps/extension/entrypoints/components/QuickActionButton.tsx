/**
 * QuickActionButton — popup 内的快捷操作按钮(打开侧边栏/收藏/通知/打赏/复制 URL)。
 * 纯展示组件,无业务逻辑,通过 onClick 回调触发。
 */
import { type ReactNode } from 'react'

export interface QuickActionButtonProps {
  label: string
  icon: ReactNode
  onClick: () => void
  variant?: 'default' | 'primary' | 'danger'
  disabled?: boolean
  badge?: number | string
  ariaLabel?: string
}

const BTN_BASE =
  'flex items-center justify-start gap-2 px-2.5 py-2 text-xs rounded-md cursor-pointer text-left w-full relative font-[inherit] transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed'

const VARIANT_CLASS: Record<NonNullable<QuickActionButtonProps['variant']>, string> = {
  default: 'border border-border bg-card text-foreground',
  primary: 'border-none bg-primary text-primary-foreground font-medium',
  danger: 'border border-destructive bg-card text-destructive',
}

export function QuickActionButton({
  label,
  icon,
  onClick,
  variant = 'default',
  disabled,
  badge,
  ariaLabel,
}: QuickActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${BTN_BASE} ${VARIANT_CLASS[variant]}`}
      aria-label={ariaLabel || label}
      data-ihui-action={label}
    >
      <span className="text-base leading-none shrink-0" aria-hidden>
        {icon}
      </span>
      <span className="flex-1 text-xs truncate">{label}</span>
      {badge !== undefined && badge !== null && badge !== '' ? (
        <span className="min-w-4.5 h-4.5 px-1.5 bg-destructive text-white rounded-lg text-xs font-semibold inline-flex items-center justify-center">
          {badge}
        </span>
      ) : null}
    </button>
  )
}

export default QuickActionButton
