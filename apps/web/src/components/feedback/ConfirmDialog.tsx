'use client'

import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  content?: React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function ConfirmDialog({
  open,
  title = '确认操作',
  content,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={
        <div className="flex items-center gap-2">
          {variant === 'danger' && <AlertTriangle className="h-5 w-5 text-destructive" />}
          {title}
        </div>
      }
      size="sm"
      footer={
        <>
          <button
            onClick={onCancel}
            className="rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50',
              variant === 'danger' ? 'bg-destructive' : 'bg-primary',
            )}
          >
            {loading ? '处理中...' : confirmText}
          </button>
        </>
      }
    >
      {content}
    </Modal>
  )
}
