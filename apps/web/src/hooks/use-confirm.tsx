'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@ihui/ui-react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

// ===== useConfirm =====

interface ConfirmConfig {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  hideCancel?: boolean
}

interface ConfirmState extends ConfirmConfig {
  resolve: ((value: boolean) => void) | null
}

export interface UseConfirmReturn {
  confirm: (config: ConfirmConfig) => Promise<boolean>
  ConfirmDialogRenderer: React.FC
}

export function useConfirm(): UseConfirmReturn {
  const t = useTranslations('common')
  const [state, setState] = React.useState<ConfirmState | null>(null)
  const stateRef = React.useRef<ConfirmState | null>(state)
  stateRef.current = state
  const tRef = React.useRef(t)
  tRef.current = t

  const confirm = React.useCallback((config: ConfirmConfig): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ ...config, resolve })
    })
  }, [])

  const handleClose = React.useCallback((result: boolean) => {
    // 2026-08-02 修复:在 setState 之外调用 resolve,避免 React 严格模式下
    // updater 被调用两次导致 resolve 被调用两次(虽然 Promise 二次 resolve 是 no-op,
    // 但违反 React 纯函数原则)
    const prev = stateRef.current
    setState(null)
    prev?.resolve?.(result)
  }, [])

  const ConfirmDialogRenderer = React.useMemo<React.FC>(
    () =>
      function ConfirmDialogRenderer() {
        const s = stateRef.current
        const ct = tRef.current
        if (!s) return null
        return (
          <ConfirmDialog
            open={true}
            title={s.title}
            description={s.description}
            confirmText={s.confirmText ?? ct('confirm')}
            cancelText={s.cancelText ?? ct('cancel')}
            variant={s.variant}
            hideCancel={s.hideCancel}
            onConfirm={() => handleClose(true)}
            onCancel={() => handleClose(false)}
          />
        )
      },
    [handleClose],
  )

  return { confirm, ConfirmDialogRenderer }
}

// ===== usePrompt =====

interface PromptConfig {
  title: string
  description?: string
  defaultValue?: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
}

interface PromptState extends PromptConfig {
  resolve: ((value: string | null) => void) | null
}

export interface UsePromptReturn {
  prompt: (config: PromptConfig) => Promise<string | null>
  PromptDialogRenderer: React.FC
}

export function usePrompt(): UsePromptReturn {
  const t = useTranslations('common')
  const [state, setState] = React.useState<PromptState | null>(null)
  const [value, setValue] = React.useState('')
  const stateRef = React.useRef<PromptState | null>(state)
  stateRef.current = state
  const valueRef = React.useRef(value)
  valueRef.current = value
  const tRef = React.useRef(t)
  tRef.current = t

  const prompt = React.useCallback((config: PromptConfig): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      setState({ ...config, resolve })
      setValue(config.defaultValue ?? '')
    })
  }, [])

  const handleClose = React.useCallback((result: string | null) => {
    // 2026-08-02 修复:同 useConfirm 的 handleClose,在 setState 之外调用 resolve
    const prev = stateRef.current
    setState(null)
    prev?.resolve?.(result)
  }, [])

  const PromptDialogRenderer = React.useMemo<React.FC>(
    () =>
      function PromptDialogRenderer() {
        const s = stateRef.current
        const v = valueRef.current
        const ct = tRef.current
        if (!s) return null
        return (
          <Dialog open={true} onOpenChange={(o) => !o && handleClose(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{s.title}</DialogTitle>
                {s.description ? <DialogDescription>{s.description}</DialogDescription> : null}
              </DialogHeader>
              <Input
                value={v}
                onChange={(e) => setValue(e.target.value)}
                placeholder={s.placeholder}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- prompt dialog 打开后立即聚焦输入框是合理 UX
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleClose(v)
                }}
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => handleClose(null)}>
                  {s.cancelText ?? ct('cancel')}
                </Button>
                <Button onClick={() => handleClose(v)}>{s.confirmText ?? ct('confirm')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      },
    [handleClose],
  )

  return { prompt, PromptDialogRenderer }
}
