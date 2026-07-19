/**
 * AdminDialog — 通用模态弹窗(纯 CSS,无 Tailwind 依赖,适配 desktop 端)。
 *
 * 设计目标:
 * - 覆盖在 admin shell 上,半透明遮罩
 * - 居中卡片,固定宽度 480 / 560 / 640(可由 size prop 切换)
 * - 提供 Header(title + 关闭按钮) / Body(可滚动) / Footer(操作栏) 三段式
 * - 受控(open + onClose),支持 ESC 键关闭
 *
 * 圆角守门:rounded-md(6px),严格遵循 §4
 */
import { useEffect, type ReactNode } from 'react'

export type AdminDialogSize = 'sm' | 'md' | 'lg'

export interface AdminDialogProps {
  open: boolean
  title: ReactNode
  onClose: () => void
  children?: ReactNode
  footer?: ReactNode
  size?: AdminDialogSize
  /** 测试 ID 透传 */
  testId?: string
}

const SIZE_CLASS: Record<AdminDialogSize, string> = {
  sm: 'admin-dialog-card admin-dialog-card-sm',
  md: 'admin-dialog-card admin-dialog-card-md',
  lg: 'admin-dialog-card admin-dialog-card-lg',
}

export function AdminDialog({
  open,
  title,
  onClose,
  children,
  footer,
  size = 'md',
  testId,
}: AdminDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="admin-dialog-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      data-testid={testId}
    >
      <div className={SIZE_CLASS[size]}>
        <header className="admin-dialog-header">
          <h3 className="admin-dialog-title">{title}</h3>
          <button
            type="button"
            className="admin-dialog-close"
            onClick={onClose}
            aria-label="close"
            data-testid={testId ? `${testId}-close` : undefined}
          >
            ×
          </button>
        </header>
        <div className="admin-dialog-body">{children}</div>
        {footer ? <footer className="admin-dialog-footer">{footer}</footer> : null}
      </div>
    </div>
  )
}

export interface AdminDialogActionsProps {
  onCancel: () => void
  onSubmit?: () => void
  submitLabel?: ReactNode
  cancelLabel?: ReactNode
  submitting?: boolean
  submitDisabled?: boolean
  submitTestId?: string
  cancelTestId?: string
}

export function AdminDialogActions({
  onCancel,
  onSubmit,
  submitLabel = '保存',
  cancelLabel = '取消',
  submitting = false,
  submitDisabled = false,
  submitTestId,
  cancelTestId,
}: AdminDialogActionsProps) {
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        data-testid={cancelTestId}
      >
        {cancelLabel}
      </button>
      {onSubmit ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || submitDisabled}
          data-testid={submitTestId}
        >
          {submitting ? '提交中...' : submitLabel}
        </button>
      ) : null}
    </>
  )
}
