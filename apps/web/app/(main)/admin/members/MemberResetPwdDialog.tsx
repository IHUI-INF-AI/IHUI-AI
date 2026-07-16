'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@ihui/ui'
import { type Member, api } from './types'

export function MemberResetPwdDialog({
  open,
  resetTarget,
  onClose,
  t,
}: {
  open: boolean
  resetTarget: Member | null
  onClose: () => void
  t: ReturnType<typeof useTranslations<'admin.members'>>
}) {
  const qc = useQueryClient()
  const [resetPwd, setResetPwd] = React.useState('')
  const [resetErr, setResetErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setResetPwd('')
      setResetErr(null)
    }
  }, [open])

  const resetPwdMut = useMutation({
    mutationFn: () =>
      api(`/api/admin/members/pwd/reset`, {
        method: 'PUT',
        body: JSON.stringify({ id: resetTarget!.id, password: resetPwd }),
      }),
    onSuccess: () => {
      toast.success(t('resetSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'members'] })
      onClose()
    },
    onError: (e: Error) => setResetErr(e.message),
  })

  function close() {
    if (resetPwdMut.isPending) return
    onClose()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setResetErr(null)
    if (!resetPwd) {
      setResetErr(t('newPasswordRequired'))
      return
    }
    if (resetPwd.length < 6) {
      setResetErr(t('passwordTooShort'))
      return
    }
    if (resetPwd.length > 20) {
      setResetErr(t('passwordTooLong'))
      return
    }
    if (/[<>"'|\\]/.test(resetPwd)) {
      setResetErr(t('passwordInvalidChar'))
      return
    }
    resetPwdMut.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? close() : null)}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('resetTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('resetDesc')}
            {resetTarget?.username ? `：${resetTarget.username}` : ''}
          </p>
          {resetErr && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {resetErr}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="m-newpwd">{t('fieldNewPassword')}</Label>
            <Input
              id="m-newpwd"
              value={resetPwd}
              onChange={(e) => setResetPwd(e.target.value)}
              placeholder={t('newPasswordPlaceholder')}
              minLength={6}
              maxLength={20}
              pattern={'^[^<>"\'|\\\\]+$'}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={resetPwdMut.isPending}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={resetPwdMut.isPending}>
              {resetPwdMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
