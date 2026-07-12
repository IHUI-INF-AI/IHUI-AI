'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Mail } from 'lucide-react'
import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { fmt } from './helpers'
import type { Invitation } from './types'

interface Props {
  isLoading: boolean
  invitations: Invitation[] | undefined
  onCancel: (id: string) => void
  cancelPending: boolean
}

export function TeamInvitationsList({ isLoading, invitations, onCancel, cancelPending }: Props) {
  const t = useTranslations('teams')
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }
  if (!invitations?.length) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        {t('noInvitations')}
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {invitations.map((inv) => (
        <div key={inv.id} className="flex items-center gap-3 rounded-md border bg-card px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <Mail className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="break-words text-sm font-medium">{inv.invitee}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {t('expiresAt')}: {fmt(inv.expiresAt)}
            </div>
          </div>
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-xs',
              inv.status === 'pending'
                ? 'bg-amber-500/10 text-amber-600'
                : inv.status === 'accepted'
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {t(`status.${inv.status}`)}
          </span>
          {inv.status === 'pending' && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => onCancel(inv.id)}
              disabled={cancelPending}
            >
              {t('cancelInvite')}
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
