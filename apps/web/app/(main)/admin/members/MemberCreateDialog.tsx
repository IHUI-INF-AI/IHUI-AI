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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { type MemberForm, type MemberLevel, EMPTY_FORM, selectClass, api } from './types'

export function MemberCreateDialog({
  open,
  onClose,
  levelsData,
  t,
}: {
  open: boolean
  onClose: () => void
  levelsData: MemberLevel[] | undefined
  t: ReturnType<typeof useTranslations<'admin.members'>>
}) {
  const qc = useQueryClient()
  const [form, setForm] = React.useState<MemberForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM)
      setErr(null)
    }
  }, [open])

  const createMut = useMutation({
    mutationFn: () => {
      const body = {
        username: form.username.trim(),
        password: form.password,
        mobile: form.mobile.trim() || null,
        email: form.email.trim() || null,
        nickname: form.nickname.trim() || null,
        gender: Number(form.gender),
        levelId: form.levelId || null,
        status: Number(form.status),
      }
      return api<{ id: string }>(`/api/admin/members`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'members'] })
      onClose()
    },
    onError: (e: Error) => setErr(e.message),
  })

  function closeDialog() {
    if (createMut.isPending) return
    onClose()
    setErr(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.username.trim()) {
      setErr(t('usernameRequired'))
      return
    }
    if (!form.password) {
      setErr(t('passwordRequired'))
      return
    }
    createMut.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? closeDialog() : null)}>
      <DialogContent className="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('createTitle')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="m-username">{t('fieldUsername')}</Label>
              <Input
                id="m-username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder={t('usernamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-password">{t('fieldPassword')}</Label>
              <Input
                id="m-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={t('passwordPlaceholder')}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="m-nickname">{t('fieldNickname')}</Label>
              <Input
                id="m-nickname"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                placeholder={t('nicknamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-mobile">{t('fieldMobile')}</Label>
              <Input
                id="m-mobile"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                placeholder={t('mobilePlaceholder')}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="m-email">{t('fieldEmail')}</Label>
              <Input
                id="m-email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={t('emailPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-gender">{t('fieldGender')}</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger className={selectClass} id="m-gender">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t('genderUnknown')}</SelectItem>
                  <SelectItem value="1">{t('genderMale')}</SelectItem>
                  <SelectItem value="2">{t('genderFemale')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="m-level">{t('fieldLevel')}</Label>
              <Select
                value={form.levelId || 'none'}
                onValueChange={(v) => setForm({ ...form, levelId: v === 'none' ? '' : v })}
              >
                <SelectTrigger className={selectClass} id="m-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noLevel')}</SelectItem>
                  {(levelsData ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-status">{t('fieldStatus')}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className={selectClass} id="m-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t('statusPending')}</SelectItem>
                  <SelectItem value="1">{t('statusActive')}</SelectItem>
                  <SelectItem value="2">{t('statusSealed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={createMut.isPending}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
