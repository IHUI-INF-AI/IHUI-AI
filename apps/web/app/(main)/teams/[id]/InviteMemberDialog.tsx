'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Plus } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCancel: () => void
  invitee: string
  setInvitee: (v: string) => void
  inviteErr: string | null
  invitePending: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  onCancel,
  invitee,
  setInvitee,
  inviteErr,
  invitePending,
  onSubmit,
}: Props) {
  const t = useTranslations('teams')
  const tc = useTranslations('common')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          {t('inviteMember')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('inviteMember')}</DialogTitle>
            <DialogDescription>{t('inviteMemberDesc')}</DialogDescription>
          </DialogHeader>
          {inviteErr && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {inviteErr}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="invitee">{t('invitee')}</Label>
            <Input
              id="invitee"
              value={invitee}
              onChange={(e) => setInvitee(e.target.value)}
              placeholder={t('inviteePlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={invitePending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={invitePending}>
              {invitePending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('sendInvite')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
