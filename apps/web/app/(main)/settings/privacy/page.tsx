'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Eye, Target, Sparkles, Loader2 } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Switch } from '@ihui/ui-react'
import { Container } from '@/components/layout'
import { fetchApi } from '@/lib/api'

interface PrivacyPrefs {
  dataVisible: boolean
  adTracking: boolean
  personalizedRecommendation: boolean
}

export default function PrivacyPage() {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const [prefs, setPrefs] = React.useState<PrivacyPrefs>({
    dataVisible: true,
    adTracking: false,
    personalizedRecommendation: true,
  })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetchApi<{ settings: Record<string, string> }>('/settings/privacy')
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          const s = res.data.settings
          setPrefs({
            dataVisible: s.dataVisible !== 'false',
            adTracking: s.adTracking === 'true',
            personalizedRecommendation: s.personalizedRecommendation !== 'false',
          })
        } else {
          setError(t('privacyLoadFailed'))
        }
      })
      .catch(() => {
        if (cancelled) return
        setError(t('privacyLoadFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [t])

  React.useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const update = async (key: keyof PrivacyPrefs, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }))
    try {
      const res = await fetchApi('/settings/privacy', {
        method: 'PUT',
        body: JSON.stringify({ [key]: String(value) }),
      })
      if (res.success) {
        setToast({ type: 'success', msg: t('privacySaveSuccess') })
      } else {
        setToast({ type: 'error', msg: t('privacySaveFailed') })
      }
    } catch {
      setToast({ type: 'error', msg: t('privacySaveFailed') })
    }
  }

  const items = [
    {
      icon: Eye,
      title: t('dataVisibility'),
      desc: t('dataVisibilityDesc'),
      key: 'dataVisible' as const,
    },
    {
      icon: Target,
      title: t('adTracking'),
      desc: t('adTrackingDesc'),
      key: 'adTracking' as const,
    },
    {
      icon: Sparkles,
      title: t('personalizedRecommendation'),
      desc: t('personalizedRecommendationDesc'),
      key: 'personalizedRecommendation' as const,
    },
  ]

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('privacyTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('privacyDesc')}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tc('loading')}
        </div>
      ) : error ? (
        <p className="py-12 text-center text-sm text-destructive">{error}</p>
      ) : (
        items.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4" />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{item.desc}</span>
                  <Switch
                    checked={prefs[item.key]}
                    onCheckedChange={(v) => update(item.key, v)}
                  />
                </div>
              </CardContent>
            </Card>
          )
        })
      )}

      {toast && (
        <div
          className={`fixed right-4 top-4 z-modal rounded-md px-4 py-2 text-sm text-white shadow-lg ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
        >
          {toast.msg}
        </div>
      )}
    </Container>
  )
}
