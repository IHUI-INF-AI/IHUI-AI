'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Settings, Loader2, Save, AlertTriangle, Trash2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button, Input, Label, Switch } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'

interface DevInfo {
  name: string
  email: string
  company?: string
  website?: string
}

interface DevPreferences {
  defaultVersion: string
  sandboxAutoRun: boolean
  errorReport: boolean
}

interface DevSettings {
  info?: DevInfo
  preferences?: DevPreferences
}

const DEFAULT_PREFS: DevPreferences = {
  defaultVersion: 'v1',
  sandboxAutoRun: false,
  errorReport: true,
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function SettingsPage() {
  const t = useTranslations('developer.settings')
  const [info, setInfo] = React.useState<DevInfo>({ name: '', email: '', company: '', website: '' })
  const [prefs, setPrefs] = React.useState<DevPreferences>(DEFAULT_PREFS)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    api<DevSettings>('/api/developer/settings')
      .then((d) => {
        if (d.info) setInfo(d.info)
        if (d.preferences) setPrefs({ ...DEFAULT_PREFS, ...d.preferences })
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const saveInfoMut = useMutation({
    mutationFn: () =>
      api('/api/developer/settings', {
        method: 'PUT',
        body: JSON.stringify({ info }),
      }),
    onSuccess: () => toast.success(t('infoSaved')),
    onError: (e: Error) => toast.error(e.message),
  })

  const savePrefsMut = useMutation({
    mutationFn: () =>
      api('/api/developer/settings', {
        method: 'PUT',
        body: JSON.stringify({ preferences: prefs }),
      }),
    onSuccess: () => toast.success(t('prefsSaved')),
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: () => api('/api/developer/settings', { method: 'DELETE' }),
    onSuccess: () => toast.success(t('accountDeleted')),
    onError: (e: Error) => toast.error(e.message),
  })

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Settings className="h-5 w-5 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="border-b pb-2 text-sm font-semibold">{t('infoTitle')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-sm">{t('infoName')}</Label>
              <Input
                value={info.name}
                onChange={(e) => setInfo({ ...info, name: e.target.value })}
                placeholder={t('infoNamePlaceholder')}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{t('infoEmail')}</Label>
              <Input
                value={info.email}
                onChange={(e) => setInfo({ ...info, email: e.target.value })}
                placeholder="dev@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{t('infoCompany')}</Label>
              <Input
                value={info.company ?? ''}
                onChange={(e) => setInfo({ ...info, company: e.target.value })}
                placeholder={t('infoCompanyPlaceholder')}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{t('infoWebsite')}</Label>
              <Input
                value={info.website ?? ''}
                onChange={(e) => setInfo({ ...info, website: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
          <Button size="sm" onClick={() => saveInfoMut.mutate()} disabled={saveInfoMut.isPending}>
            {saveInfoMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t('saveInfo')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="border-b pb-2 text-sm font-semibold">{t('prefsTitle')}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">{t('prefsDefaultVersion')}</Label>
                <p className="text-xs text-muted-foreground">{t('prefsDefaultVersionDesc')}</p>
              </div>
              <Input
                value={prefs.defaultVersion}
                onChange={(e) => setPrefs({ ...prefs, defaultVersion: e.target.value })}
                className="w-24"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">{t('prefsSandboxAutoRun')}</Label>
                <p className="text-xs text-muted-foreground">{t('prefsSandboxAutoRunDesc')}</p>
              </div>
              <Switch
                checked={prefs.sandboxAutoRun}
                onCheckedChange={(v) => setPrefs({ ...prefs, sandboxAutoRun: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">{t('prefsErrorReport')}</Label>
                <p className="text-xs text-muted-foreground">{t('prefsErrorReportDesc')}</p>
              </div>
              <Switch
                checked={prefs.errorReport}
                onCheckedChange={(v) => setPrefs({ ...prefs, errorReport: v })}
              />
            </div>
          </div>
          <Button size="sm" onClick={() => savePrefsMut.mutate()} disabled={savePrefsMut.isPending}>
            {savePrefsMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t('savePrefs')}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-rose-500/30">
        <CardContent className="space-y-3 p-4">
          <p className="flex items-center gap-2 border-b pb-2 text-sm font-semibold text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4" />
            {t('dangerTitle')}
          </p>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">{t('dangerDeleteLabel')}</Label>
              <p className="text-xs text-muted-foreground">{t('dangerDeleteDesc')}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
              onClick={() => confirm(t('dangerDeleteConfirm')) && deleteMut.mutate()}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {t('dangerDeleteBtn')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {(saveInfoMut.isError || savePrefsMut.isError || deleteMut.isError) && (
        <Alert
          variant="danger"
          description={
            ((saveInfoMut.error || savePrefsMut.error || deleteMut.error) as Error).message
          }
        />
      )}
    </div>
  )
}
