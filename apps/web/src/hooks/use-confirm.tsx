'use client'

import * as React from 'react'

interface ConfirmState {
  open: boolean
  message: string
  resolve: ((value: boolean) => void) | null
}

export interface UseConfirmReturn {
  confirm: (message: string) => Promise<boolean>
  ConfirmDialog: React.FC
}

/** 确认对话框内部组件，props 驱动，避免组件身份变化导致重挂载 */
function ConfirmDialogInner({
  open,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-w-sm rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
        <p className="mb-4 text-sm text-gray-900 dark:text-gray-100">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}

export function useConfirm(): UseConfirmReturn {
  const [state, setState] = React.useState<ConfirmState>({
    open: false,
    message: '',
    resolve: null,
  })
  const stateRef = React.useRef(state)
  stateRef.current = state

  const confirm = React.useCallback((message: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, message, resolve })
    })
  }, [])

  const handleClose = React.useCallback((result: boolean) => {
    setState((prev) => {
      prev.resolve?.(result)
      return { open: false, message: '', resolve: null }
    })
  }, [])

  // 稳定的组件引用，通过 ref 读取最新 state，避免重挂载
  const ConfirmDialog = React.useMemo<React.FC>(
    () =>
      function ConfirmDialog() {
        const s = stateRef.current
        return (
          <ConfirmDialogInner
            open={s.open}
            message={s.message}
            onConfirm={() => handleClose(true)}
            onCancel={() => handleClose(false)}
          />
        )
      },
    [handleClose],
  )

  return { confirm, ConfirmDialog }
}
