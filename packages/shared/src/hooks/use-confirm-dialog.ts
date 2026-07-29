'use client'

import * as React from 'react'

interface ConfirmDialogState {
  open: boolean
  title: string
  description?: string
  confirmText: string
  cancelText: string
  variant: 'default' | 'danger'
  resolve: ((value: boolean) => void) | null
}

export interface UseConfirmDialogReturn {
  open: boolean
  title: string
  description?: string
  confirmText: string
  cancelText: string
  variant: 'default' | 'danger'
  confirm: (options?: {
    title?: string
    description?: string
    confirmText?: string
    cancelText?: string
    variant?: 'default' | 'danger'
  }) => Promise<boolean>
  handleConfirm: () => void
  handleCancel: () => void
}

const INITIAL: ConfirmDialogState = {
  open: false,
  title: '确认操作',
  description: undefined,
  confirmText: '确认',
  cancelText: '取消',
  variant: 'default',
  resolve: null,
}

/** 确认对话框 Hook，返回 Promise 供调用方 await，并提供受控状态 */
export function useConfirmDialog(): UseConfirmDialogReturn {
  const [state, setState] = React.useState<ConfirmDialogState>(INITIAL)

  const confirm = React.useCallback(
    (options?: {
      title?: string
      description?: string
      confirmText?: string
      cancelText?: string
      variant?: 'default' | 'danger'
    }): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setState({
          open: true,
          title: options?.title ?? '确认操作',
          description: options?.description,
          confirmText: options?.confirmText ?? '确认',
          cancelText: options?.cancelText ?? '取消',
          variant: options?.variant ?? 'default',
          resolve,
        })
      })
    },
    [],
  )

  const handleClose = React.useCallback((result: boolean) => {
    setState((prev) => {
      prev.resolve?.(result)
      return INITIAL
    })
  }, [])

  return {
    open: state.open,
    title: state.title,
    description: state.description,
    confirmText: state.confirmText,
    cancelText: state.cancelText,
    variant: state.variant,
    confirm,
    handleConfirm: () => handleClose(true),
    handleCancel: () => handleClose(false),
  }
}
