'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Battery, ChevronRight, Cpu, Loader2, Lock, MapPin, Power, Signal, Unlock, Upload } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatShortDateTime } from '@/lib/date-utils'
import { Button, Card, CardContent, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Label } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'

interface Device {
  id: string; deviceNo: string; deviceName: string | null; deviceType: string
  userId: string | null; status: string; signal: number | null; battery: number | null
  latitude: string | null; longitude: string | null; firmwareVersion: string | null
  lastOnlineAt: string | null; registeredAt: string; updatedAt: string
}
interface CommandRecord {
  id: string; deviceId: string; command: string; status: string
  payload: Record<string, unknown> | null; sentAt: string | null
  ackedAt: string | null; result: string | null; createdAt: string; updatedAt: string
}
interface RegisterForm { deviceNo: string; deviceName: string; deviceType: string }
interface RequestError extends Error { status?: number }

const EMPTY_FORM: RegisterForm = { deviceNo: '', deviceName: '', deviceType: '' }
const STATUS_STYLES: Record<string, string> = {
  online: 'bg-emerald-500/10 text-emerald-600', offline: 'bg-gray-500/10 text-gray-600', sleep: 'bg-amber-500/10 text-amber-600',
}
const CMD_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600', sent: 'bg-sky-500/10 text-sky-600', ack: 'bg-emerald-500/10 text-emerald-600', failed: 'bg-rose-500/10 text-rose-600',
}
const COMMANDS = [{ cmd: 'reboot', Icon: Power }, { cmd: 'lock', Icon: Lock }, { cmd: 'unlock', Icon: Unlock }, { cmd: 'upgrade', Icon: Upload }] as const

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) { const e = new Error(r.error) as RequestError; e.status = r.status; throw e }
  return r.data
}

export default function TboxPage() {
  const t = useTranslations('eduAi.tbox')
  const locale = useLocale()
  const qc = useQueryClient()
  const [form, setForm] = React.useState<RegisterForm>(EMPTY_FORM)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)

  const { data, isLoading, isError, error } = useQuery({ queryKey: ['tbox-devices'], queryFn: () => api<Device[]>('/api/tbox/devices') })
  const detailQuery = useQuery({ queryKey: ['tbox-devices', 'detail', selectedId], queryFn: () => api<Device>(`/api/tbox/devices/${selectedId}`), enabled: selectedId !== null })
  const commandsQuery = useQuery({ queryKey: ['tbox-devices', 'commands', selectedId], queryFn: () => api<CommandRecord[]>(`/api/tbox/devices/${selectedId}/commands`), enabled: selectedId !== null && detailOpen })
  const registerMutation = useMutation({
    mutationFn: (v: RegisterForm) => api<Device>('/api/tbox/devices', { method: 'POST', body: JSON.stringify({ deviceNo: v.deviceNo.trim(), deviceName: v.deviceName.trim() || undefined, deviceType: v.deviceType.trim() || undefined }) }),
    onSuccess: () => { setForm(EMPTY_FORM); qc.invalidateQueries({ queryKey: ['tbox-devices'] }) },
  })
  const commandMutation = useMutation({
    mutationFn: (cmd: string) => api<CommandRecord>(`/api/tbox/devices/${selectedId}/command`, { method: 'POST', body: JSON.stringify({ command: cmd }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tbox-devices', 'commands', selectedId] }),
  })

  const devices = data ?? []
  const detail = detailQuery.data
  const commands = commandsQuery.data ?? []

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); if (form.deviceNo.trim()) registerMutation.mutate(form) }
  const field = (key: keyof RegisterForm, label: string, ph?: string) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{t(label)}</Label>
      <Input id={key} value={form[key]} placeholder={ph} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value })} className="h-9" />
    </div>
  )
  const infoRow = (label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{t(label)}</span>{value}
    </div>
  )
  const badge = (s: string, styles: Record<string, string>) => cn('rounded-md px-2 py-0.5 text-xs font-medium', styles[s] ?? styles.offline ?? '')

  return (
    <div className="space-y-4">
      <BackButton />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Cpu className="h-7 w-7 text-primary" />{t('title')}</h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Cpu className="h-4 w-4 text-primary" />{t('registerDevice')}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-3">
              {field('deviceNo', 'deviceNo')}{field('deviceName', 'deviceName')}{field('deviceType', 'deviceType', 'tbox')}
            </div>
            {registerMutation.error && <Alert variant="danger" title={t('error')} description={(registerMutation.error as Error).message} />}
            <Button type="submit" disabled={registerMutation.isPending}>
              {registerMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {registerMutation.isPending ? t('loading') : t('registerDevice')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Cpu className="h-5 w-5 text-primary" />{t('devices')}</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t('loading')}</div>
        ) : isError ? (
          <Alert variant="danger" title={t('error')} description={(error as Error).message} />
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10">
            <Cpu className="h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">{t('noDevices')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
            {devices.map((d) => (
              <Card key={d.id} className="flex cursor-pointer flex-col transition-colors hover:bg-accent" onClick={() => { setSelectedId(d.id); setDetailOpen(true) }}>
                <CardContent className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{d.deviceName || d.deviceNo}</span>
                    <span className={badge(d.status, STATUS_STYLES)}>{t(d.status)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Signal className="h-3.5 w-3.5" />{t('signal')}: {d.signal ?? '-'}</span>
                    <span className="flex items-center gap-1"><Battery className="h-3.5 w-3.5" />{t('battery')}: {d.battery !== null ? `${d.battery}%` : '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="truncate text-xs text-muted-foreground">{d.deviceNo} · {d.deviceType}</span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-primary">{d.lastOnlineAt ? formatShortDateTime(d.lastOnlineAt, locale) : '-'}<ChevronRight className="h-3.5 w-3.5" /></span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8"><Cpu className="h-4 w-4 text-primary" />{detail?.deviceName || detail?.deviceNo || t('devices')}</DialogTitle>
            <DialogDescription>{detail ? `${t('deviceNo')}: ${detail.deviceNo}` : t('loading')}</DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('loading')}</div>
          ) : detailQuery.isError ? (
            <Alert variant="danger" title={t('error')} description={(detailQuery.error as Error).message} />
          ) : detail ? (
            <div className="space-y-4 text-sm">
              <div className="space-y-2">
                {infoRow('status', <span className={badge(detail.status, STATUS_STYLES)}>{t(detail.status)}</span>)}
                {infoRow('firmwareVersion', <span>{detail.firmwareVersion || '-'}</span>)}
                {infoRow('signal', <span className="flex items-center gap-1"><Signal className="h-3.5 w-3.5" />{detail.signal ?? '-'}</span>)}
                {infoRow('battery', <span className="flex items-center gap-1"><Battery className="h-3.5 w-3.5" />{detail.battery !== null ? `${detail.battery}%` : '-'}</span>)}
                {infoRow('location', <span>{detail.latitude && detail.longitude ? `${detail.latitude}, ${detail.longitude}` : '-'}</span>)}
                {infoRow('lastOnline', <span>{detail.lastOnlineAt ? formatShortDateTime(detail.lastOnlineAt, locale) : '-'}</span>)}
              </div>
              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 font-medium"><Power className="h-4 w-4 text-primary/70" />{t('sendCommand')}</h3>
                <div className="flex flex-wrap gap-2">
                  {COMMANDS.map(({ cmd, Icon }) => (
                    <Button key={cmd} size="sm" variant="outline" disabled={commandMutation.isPending} onClick={() => commandMutation.mutate(cmd)}>
                      <Icon className="mr-1.5 h-4 w-4" />{t(cmd)}
                    </Button>
                  ))}
                </div>
                {commandMutation.isError && <Alert variant="danger" title={t('error')} description={(commandMutation.error as Error).message} />}
              </div>
              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 font-medium"><MapPin className="h-4 w-4 text-primary/70" />{t('commandHistory')}</h3>
                {commandsQuery.isLoading ? (
                  <div className="flex items-center gap-2 py-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('loading')}</div>
                ) : commands.length === 0 ? (
                  <p className="text-xs text-muted-foreground">-</p>
                ) : (
                  <div className="space-y-1.5">
                    {commands.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{t(c.command)}</span>
                          <span className={badge(c.status, CMD_STATUS_STYLES)}>{t(c.status)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t('sentAt')}: {c.sentAt ? formatShortDateTime(c.sentAt, locale) : '-'}
                          {c.ackedAt && <span className="ml-2">{t('ackedAt')}: {formatShortDateTime(c.ackedAt, locale)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
