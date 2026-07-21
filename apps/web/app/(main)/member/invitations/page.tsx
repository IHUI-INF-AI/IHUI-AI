'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { Users, Loader2, Gift, Copy, Check, UserPlus } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

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
  rewardInvitee: number
  usedAt: string | null
  createdAt: string
}

const STATUS_CLS: Record<Invitation['status'], string> = {
  unused: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  expired: 'bg-muted text-muted-foreground',
  used: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function MemberInvitationsPage() {
  const t = useTranslations('memberInvitationsPage')
  const locale = useLocale()
  const qc = useQueryClient()
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const codesQ = useQuery({
    queryKey: ['member', 'invitations'],
    queryFn: () =>
      api<{ list: Invitation[] }>('/api/invitations')
        .then((d) => d.list ?? [])
        .catch(() => [] as Invitation[]),
  })
  const inviteesQ = useQuery({
    queryKey: ['member', 'invitations', 'invitees'],
    queryFn: () =>
      api<{ list: Invitee[] }>('/api/invitations/invitees')
        .then((d) => d.list ?? [])
        .catch(() => [] as Invitee[]),
  })

  const genMut = useMutation({
    mutationFn: () => api<{ invitation: Invitation }>('/api/invitations', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', 'invitations'] }),
  })

  const handleCopy = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500)
    } catch {
      setCopiedId(null)
    }
  }

  const codes = codesQ.data ?? []
  const invitees = inviteesQ.data ?? []
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const fmt = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Users className="h-5 w-5 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Button size="sm" onClick={() => genMut.mutate()} disabled={genMut.isPending}>
          {genMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Gift className="h-4 w-4" />
          )}
          {t('generate')}
        </Button>
      </div>

      {genMut.isError && <Alert variant="danger" description={(genMut.error as Error).message} />}

      <div>
        <h2 className="mb-2 text-sm font-semibold">{t('codesTitle')}</h2>
        {codesQ.isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : codes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <Gift className="h-8 w-8 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">{t('codesEmpty')}</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {codes.map((c) => (
              <Card key={c.id} className="transition-colors hover:bg-accent">
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-center justify-between">
                    <code className="rounded bg-muted/50 px-2 py-0.5 font-mono text-sm">
                      {c.code}
                    </code>
                    <span
                      className={cn(
                        'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
                        STATUS_CLS[c.status],
                      )}
                    >
                      {t(`status.${c.status}`)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Gift className="h-3 w-3" />
                    {t('rewards', { inviter: c.rewardInviter, invitee: c.rewardInvitee })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('expiresAt')}{fmt(c.expiresAt)}
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
                    {copiedId === c.id ? t('copied') : t('copyCode')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <UserPlus className="h-4 w-4" />
          {t('inviteesTitle')}
        </h2>
        {inviteesQ.isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : invitees.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">{t('inviteesEmpty')}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('columns.user')}</th>
                  <th className="px-3 py-2 font-medium">{t('columns.registeredAt')}</th>
                  <th className="px-3 py-2 font-medium">{t('columns.reward')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invitees.map((u) => (
                  <tr key={u.invitationId} className="transition-colors hover:bg-accent/50">
                    <td className="px-3 py-2 font-medium">
                      {u.inviteeNickname ?? u.inviteeEmail ?? '-'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {fmt(u.usedAt ?? u.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">+{u.rewardInvitee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
