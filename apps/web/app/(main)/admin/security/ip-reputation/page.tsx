'use client'
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Search, Ban, ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
  Button,
  Input,
  Badge,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  cn,
} from '@ihui/ui-react'
import {
  fetchIpReputation,
  blockIp,
  unblockIp,
  scoreClass,
  scoreLabel,
  DURATION_OPTIONS,
} from './helpers'

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/

const REASON_CLASS: Record<string, string> = {
  blacklisted: 'bg-red-500/10 text-red-600 dark:text-red-400',
  'tor-exit-node': 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  'known-proxy': 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  'datacenter-ip': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

function reasonClass(reason: string): string {
  if (REASON_CLASS[reason]) return REASON_CLASS[reason]
  if (reason.startsWith('bad-events'))
    return 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
  return 'bg-muted text-muted-foreground'
}

export default function IpReputationPage() {
  const t = useTranslations('admin.ipReputation')
  const qc = useQueryClient()
  const [ip, setIp] = React.useState('')
  const [queryIp, setQueryIp] = React.useState('')
  const [duration, setDuration] = React.useState<number>(DURATION_OPTIONS[0]?.value ?? 3600)
  const [reason, setReason] = React.useState('')

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['admin', 'ip-reputation', queryIp],
    queryFn: () => fetchIpReputation(queryIp),
    enabled: !!queryIp,
  })

  const blocked = data?.reasons.includes('blacklisted') ?? false

  const blockMut = useMutation({
    mutationFn: () => blockIp({ ip: queryIp, duration, reason: reason.trim() || undefined }),
    onSuccess: () => {
      toast.success(t('blockSuccess'))
      setReason('')
      qc.invalidateQueries({ queryKey: ['admin', 'ip-reputation', queryIp] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const unblockMut = useMutation({
    mutationFn: () => unblockIp(queryIp),
    onSuccess: () => {
      toast.success(t('unblockSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'ip-reputation', queryIp] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function handleQuery() {
    const v = ip.trim()
    if (!IP_REGEX.test(v)) {
      toast.error(t('invalidIp'))
      return
    }
    setQueryIp(v)
  }

  const busy = isLoading || isFetching
  const mutPending = blockMut.isPending || unblockMut.isPending

  function handleBlock() {
    if (window.confirm(t('blockConfirm'))) blockMut.mutate()
  }
  function handleUnblock() {
    if (window.confirm(t('unblockConfirm'))) unblockMut.mutate()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldAlert className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuery()
            }}
            placeholder={t('searchPlaceholder')}
            className="pl-8"
          />
        </div>
        <Button onClick={handleQuery} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {t('query')}
        </Button>
      </div>

      {queryIp && busy && !data && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {queryIp && error && !data && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {queryIp && data && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  {queryIp}
                </CardTitle>
                <CardDescription>{t('overview')}</CardDescription>
              </div>
              <Badge variant="secondary">
                {data.source === 'live' ? t('sourceLive') : t('sourceCache')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className={cn('text-4xl font-bold tabular-nums', scoreClass(data.score))}>
                {data.score}
              </span>
              <span className={cn('text-sm font-medium', scoreClass(data.score))}>
                {scoreLabel(data.score)}
              </span>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('reasons')}</p>
              {data.reasons.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noReasons')}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {data.reasons.map((r) => (
                    <Badge
                      key={r}
                      variant="outline"
                      className={cn('border-transparent', reasonClass(r))}
                    >
                      {r}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center gap-2">
            {blocked ? (
              <Button
                variant="destructive"
                onClick={handleUnblock}
                disabled={mutPending || isFetching}
              >
                {unblockMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {t('unblock')}
              </Button>
            ) : (
              <>
                <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('blockReasonPlaceholder')}
                  className="min-w-40 flex-1"
                />
                <Button
                  variant="destructive"
                  onClick={handleBlock}
                  disabled={mutPending || isFetching}
                >
                  {blockMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Ban className="h-4 w-4" />
                  )}
                  {t('block')}
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
