/**
 * P1-2.2: 通用确认弹窗
 * - 暂停/恢复/备份:普通确认
 * - 销毁:必须输入 slug 二次确认
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Button,
} from '@ihui/ui'

interface ConfirmActionDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  requireInput?: string // 销毁模式:用户必须输入相同 slug 才解锁
  pending?: boolean
  onConfirm: () => void
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText,
  variant = 'default',
  requireInput,
  pending = false,
  onConfirm,
}: ConfirmActionDialogProps) {
  const t = useTranslations('admin.saas')
  const [input, setInput] = React.useState('')
  React.useEffect(() => {
    if (!open) setInput('')
  }, [open])
  const canConfirm = !requireInput || input === requireInput
  const isDestructive = variant === 'destructive'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {requireInput ? (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              {t('confirm.destroyInputHint', { slug: requireInput })}
            </p>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={requireInput}
              autoComplete="off"
            />
          </div>
        ) : null}
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelText ?? t('confirm.cancel')}
          </Button>
          <Button
            type="button"
            variant={isDestructive ? 'destructive' : 'default'}
            disabled={!canConfirm || pending}
            onClick={onConfirm}
          >
            {confirmText ?? t('confirm.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
