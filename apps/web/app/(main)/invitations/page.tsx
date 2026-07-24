'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, UserPlus, Copy, Gift, Clock, Check, Users } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/data/Avatar'

interface Invitation {
  id: string
  code: string
  rewardInviter: number
  rewardInvitee: number
  status: 'unused' | 'used' | 'expired'
  expiresAt: string
}

interface Invitee {
  invitationId: string
  inviteeNickname: string | null
  inviteeEmail: string | null
  status: string
  rewardInviter: number
  rewardInvitee: number
  usedAt: string | null
  createdAt: string
}

const STATUS_STYLE: Record<Invitation['status'], string> = {
  unused: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  expired: 'bg-muted text-muted-foreground',
  used: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function InvitationsPage() {
  const t = useTranslations('invitations')
  const locale = useLocale()
  const qc = useQueryClient()

  const codesQ = useQuery({
    queryKey: ['invitations'],
    queryFn: () => api<{ list: Invitation[] }>('/api/invitations').then((d) => d.list ?? []),
  })
  const inviteesQ = useQuery({
    queryKey: ['invitations', 'invitees'],
    queryFn: () => api<{ list: Invitee[] }>('/api/invitations/invitees').then((d) => d.list ?? []),
  })

  const genMut = useMutation({
    mutationFn: () =>
      api<{ invitation: Invitation }>('/api/invitations', { method: 'POST' }).then(
        (d) => d.invitation,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations'] }),
  })

  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const handleCopy = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500)
    } catch {
      setCopiedId(null)
    }
  }

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v?: string) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const codes = codesQ.data ?? []
  const invitees = inviteesQ.data ?? []

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={() => genMut.mutate()} disabled={genMut.isPending}>
          {genMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Gift className="h-4 w-4" />
          )}
          {t('generate')}
        </Button>
      </header>

      {genMut.isError && (
        <div className="text-xs text-destructive">{(genMut.error as Error).message}</div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{t('myCodes')}</h2>
        {codesQ.isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : codesQ.error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {(codesQ.error as Error).message}
          </div>
        ) : codes.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {codes.map((c) => (
              <Card key={c.id} className="transition-colors hover:bg-accent">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <code className="rounded bg-muted/50 px-2 py-0.5 font-mono text-sm">
                      {c.code}
                    </code>
                    <span
                      className={cn(
                        'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
                        STATUS_STYLE[c.status],
                      )}
                    >
                      {t(`status.${c.status}`)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Gift className="h-3.5 w-3.5" />
                    {t('rewardValue', { inviter: c.rewardInviter, invitee: c.rewardInvitee })}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {t('expiresAt')}: {fmt(c.expiresAt)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleCopy(c.code, c.id)}
                    disabled={c.status !== 'unused'}
                  >
                    {copiedId === c.id ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copiedId === c.id ? t('copied') : t('copy')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <Gift className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('emptyCodes')}</p>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Users className="h-4 w-4" />
          {t('invitees')}
        </h2>
        {inviteesQ.isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : inviteesQ.error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {(inviteesQ.error as Error).message}
          </div>
        ) : invitees.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{t('user')}</th>
                  <th className="px-4 py-2 text-left font-medium">{t('registeredAt')}</th>
                  <th className="px-4 py-2 text-left font-medium">{t('reward')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invitees.map((u) => {
                  const name = u.inviteeNickname ?? u.inviteeEmail ?? '-'
                  return (
                    <tr key={u.invitationId} className="transition-colors hover:bg-accent/50">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar name={name ?? 'U'} size="xs" />
                          <span className="font-medium">{name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {fmt(u.usedAt ?? u.createdAt)}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{u.rewardInvitee}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('emptyInvitees')}</p>
          </div>
        )}
      </section>
    </div>
  )
}
