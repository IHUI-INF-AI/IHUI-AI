'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, KeyRound, Trash2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@ihui/ui'

interface AuthorizedItem {
  id: string
  clientId: string
  appName: string
  scope: string | null
  createdAt: string
  lastUsedAt: string | null
}

export default function MyAuthorizedPage() {
  const t = useTranslations('oauth')
  const tc = useTranslations('common')
  const locale = useLocale()

  const [items, setItems] = React.useState<AuthorizedItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [revokingId, setRevokingId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetchApi<{ items: AuthorizedItem[] }>('/api/auth/oauth/my-authorized')
    if (!res.success) setError(res.error)
    else setItems(res.data.items ?? [])
    setLoading(false)
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const onRevoke = async (id: string) => {
    setRevokingId(id)
    const res = await fetchApi(`/api/auth/oauth/my-authorized/${id}`, { method: 'DELETE' })
    setRevokingId(null)
    if (!res.success) {
      setError(res.error)
      return
    }
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <KeyRound className="h-6 w-6 text-primary" />
          {t('myAuthorized')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('myAuthorizedDesc')}</p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('search')}...
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {t('noAuthorizations')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <Card key={it.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="break-words text-base">{it.appName}</CardTitle>
                    <CardDescription className="text-xs">{it.clientId}</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={revokingId === it.id}
                    onClick={() => onRevoke(it.id)}
                  >
                    {revokingId === it.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    {t('revoke')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                {it.scope && (
                  <div>
                    <span className="font-medium text-foreground">{t('scopes')}:</span> {it.scope}
                  </div>
                )}
                <div>
                  <span className="font-medium text-foreground">{t('authorizedAt')}:</span>{' '}
                  {dateFmt.format(new Date(it.createdAt))}
                </div>
                {it.lastUsedAt && (
                  <div>
                    <span className="font-medium text-foreground">{t('lastUsedAt')}:</span>{' '}
                    {dateFmt.format(new Date(it.lastUsedAt))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
