/**
 * QuickActionButton — popup 内的快捷操作按钮(打开侧边栏/收藏/通知/打赏/复制 URL)。
 * 纯展示组件,无业务逻辑,通过 onClick 回调触发。
 */
import { type CSSProperties, type ReactNode } from 'react'

export interface QuickActionButtonProps {
  label: string
  icon: ReactNode
  onClick: () => void
  variant?: 'default' | 'primary' | 'danger'
  disabled?: boolean
  badge?: number | string
  ariaLabel?: string
}

const baseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 8,
  padding: '8px 10px',
  fontSize: 12,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--card)',
  color: 'var(--fg)',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  position: 'relative',
  fontFamily: 'inherit',
  transition: 'background 0.12s ease',
}

const primaryStyle: CSSProperties = {
  ...baseStyle,
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  fontWeight: 500,
}

const dangerStyle: CSSProperties = {
  ...baseStyle,
  color: 'var(--danger)',
  borderColor: 'var(--danger)',
  background: 'var(--card)',
}

const iconStyle: CSSProperties = {
  fontSize: 16,
  lineHeight: 1,
  flexShrink: 0,
}

const labelStyle: CSSProperties = {
  flex: 1,
  fontSize: 12,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const badgeStyle: CSSProperties = {
  minWidth: 18,
  height: 18,
  padding: '0 6px',
  background: '#ef4444',
  color: '#fff',
  borderRadius: 9,
  fontSize: 10,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
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
  const style = variant === 'primary' ? primaryStyle : variant === 'danger' ? dangerStyle : baseStyle
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={style}
      aria-label={ariaLabel || label}
      data-ihui-action={label}
    >
      <span style={iconStyle} aria-hidden>
        {icon}
      </span>
      <span style={labelStyle}>{label}</span>
      {badge !== undefined && badge !== null && badge !== '' ? (
        <span style={badgeStyle}>{badge}</span>
      ) : null}
    </button>
  )
}

export default QuickActionButton
