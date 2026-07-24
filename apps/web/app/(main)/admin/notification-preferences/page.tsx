'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Bell } from 'lucide-react'
import { Button, Input, Label, Switch, Card, CardHeader, CardTitle, CardContent } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'

interface FormState {
  emailEnabled: boolean
  smsEnabled: boolean
  inAppEnabled: boolean
  orderNotification: boolean
  paymentNotification: boolean
  examNotification: boolean
  agentNotification: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  maxPerHour: number
  maxPerDay: number
}

interface ApiPrefs {
  emailEnabled?: boolean
  smsEnabled?: boolean
  inAppEnabled?: boolean
  types?: string[]
  quietHoursEnabled?: boolean
  quietHoursStart?: string | null
  quietHoursEnd?: string | null
  maxPerHour?: number
  maxPerDay?: number
}

const BUSINESS_KEYS = ['order', 'payment', 'exam', 'agent'] as const

const DEFAULTS: FormState = {
  emailEnabled: true,
  smsEnabled: false,
  inAppEnabled: true,
  orderNotification: true,
  paymentNotification: true,
  examNotification: true,
  agentNotification: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  maxPerHour: 20,
  maxPerDay: 100,
}

function SwitchRow({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}

export default function NotificationPreferencesPage() {
  const t = useTranslations('adminTools.notificationPreferences')
  const qc = useQueryClient()
  const [form, setForm] = React.useState<FormState>(DEFAULTS)
  const [preservedTypes, setPreservedTypes] = React.useState<string[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'notification-preferences'],
    queryFn: async () => {
      const r = await fetchApi<ApiPrefs>('/notifications/preferences')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  React.useEffect(() => {
    if (!data) return
    const types = data.types ?? []
    setPreservedTypes(types.filter((x) => !(BUSINESS_KEYS as readonly string[]).includes(x)))
    setForm({
      emailEnabled: data.emailEnabled ?? true,
      smsEnabled: data.smsEnabled ?? false,
      inAppEnabled: data.inAppEnabled ?? true,
      orderNotification: types.includes('order'),
      paymentNotification: types.includes('payment'),
      examNotification: types.includes('exam'),
      agentNotification: types.includes('agent'),
      quietHoursEnabled: data.quietHoursEnabled ?? DEFAULTS.quietHoursEnabled,
      quietHoursStart: data.quietHoursStart ?? DEFAULTS.quietHoursStart,
      quietHoursEnd: data.quietHoursEnd ?? DEFAULTS.quietHoursEnd,
      maxPerHour: data.maxPerHour ?? DEFAULTS.maxPerHour,
      maxPerDay: data.maxPerDay ?? DEFAULTS.maxPerDay,
    })
  }, [data])

  const saveMut = useMutation({
    mutationFn: async () => {
      const businessTypes = BUSINESS_KEYS.filter((k) => Boolean(form[`${k}Notification`]))
      const types = [...preservedTypes, ...businessTypes]
      const r = await fetchApi('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          emailEnabled: form.emailEnabled,
          smsEnabled: form.smsEnabled,
          inAppEnabled: form.inAppEnabled,
          types,
          quietHoursEnabled: form.quietHoursEnabled,
          quietHoursStart: form.quietHoursEnabled ? form.quietHoursStart : null,
          quietHoursEnd: form.quietHoursEnabled ? form.quietHoursEnd : null,
          maxPerHour: form.maxPerHour,
          maxPerDay: form.maxPerDay,
        }),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success(t('saved'))
      qc.invalidateQueries({ queryKey: ['admin', 'notification-preferences'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    saveMut.mutate()
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bell className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('loading')}
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('systemNotifications')}</CardTitle>
            </CardHeader>
            <CardContent>
              <SwitchRow
                id="emailEnabled"
                label={t('emailEnabled')}
                checked={form.emailEnabled}
                onChange={(v) => update('emailEnabled', v)}
              />
              <SwitchRow
                id="smsEnabled"
                label={t('smsEnabled')}
                checked={form.smsEnabled}
                onChange={(v) => update('smsEnabled', v)}
              />
              <SwitchRow
                id="inAppEnabled"
                label={t('inAppEnabled')}
                checked={form.inAppEnabled}
                onChange={(v) => update('inAppEnabled', v)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('businessNotifications')}</CardTitle>
            </CardHeader>
            <CardContent>
              <SwitchRow
                id="orderNotification"
                label={t('orderNotification')}
                checked={form.orderNotification}
                onChange={(v) => update('orderNotification', v)}
              />
              <SwitchRow
                id="paymentNotification"
                label={t('paymentNotification')}
                checked={form.paymentNotification}
                onChange={(v) => update('paymentNotification', v)}
              />
              <SwitchRow
                id="examNotification"
                label={t('examNotification')}
                checked={form.examNotification}
                onChange={(v) => update('examNotification', v)}
              />
              <SwitchRow
                id="agentNotification"
                label={t('agentNotification')}
                checked={form.agentNotification}
                onChange={(v) => update('agentNotification', v)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('quietHours')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <SwitchRow
                id="quietHoursEnabled"
                label={t('quietHoursEnabled')}
                checked={form.quietHoursEnabled}
                onChange={(v) => update('quietHoursEnabled', v)}
              />
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="quietHoursStart" className="text-sm">
                    {t('quietHoursStart')}
                  </Label>
                  <Input
                    id="quietHoursStart"
                    type="time"
                    value={form.quietHoursStart}
                    onChange={(e) => update('quietHoursStart', e.target.value)}
                    disabled={!form.quietHoursEnabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="quietHoursEnd" className="text-sm">
                    {t('quietHoursEnd')}
                  </Label>
                  <Input
                    id="quietHoursEnd"
                    type="time"
                    value={form.quietHoursEnd}
                    onChange={(e) => update('quietHoursEnd', e.target.value)}
                    disabled={!form.quietHoursEnabled}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('frequencyLimit')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="maxPerHour" className="text-sm">
                    {t('maxPerHour')}
                  </Label>
                  <Input
                    id="maxPerHour"
                    type="number"
                    min={0}
                    value={form.maxPerHour}
                    onChange={(e) => update('maxPerHour', Number(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="maxPerDay" className="text-sm">
                    {t('maxPerDay')}
                  </Label>
                  <Input
                    id="maxPerDay"
                    type="number"
                    min={0}
                    value={form.maxPerDay}
                    onChange={(e) => update('maxPerDay', Number(e.target.value) || 0)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? t('saving') : t('save')}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
