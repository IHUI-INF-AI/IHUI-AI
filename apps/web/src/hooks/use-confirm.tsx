'use client'

import * as React from 'react'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui'

interface ConfirmState {
  open: boolean
  message: string
  resolve: ((value: boolean) => void) | null
}

export interface UseConfirmReturn {
  confirm: (message: string) => Promise<boolean>
  ConfirmDialog: React.FC
}

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
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{message}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" size="sm" className="bg-muted" onClick={onCancel}>
            取消
          </Button>
          <Button size="sm" onClick={onConfirm}>
            确认
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
