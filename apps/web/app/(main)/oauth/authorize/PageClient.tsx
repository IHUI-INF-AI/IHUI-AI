'use client'

import * as React from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, ShieldCheck, ShieldAlert, Check } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@ihui/ui-react'

interface ScopeInfo {
  scope: string
  name: string
  description: string
  icon?: string
}

interface AuthorizeInfo {
  app: { name: string; clientId: string }
  scopes: ScopeInfo[]
}

interface ApproveResult {
  code: string
  state: string
}

function AuthorizeContent() {
  const t = useTranslations('oauth')
  const router = useRouter()
  const params = useSearchParams()
  const token = useAuthStore((s) => s.token)

  const clientId = params.get('client_id') ?? ''
  const redirectUri = params.get('redirect_uri') ?? ''
  const scope = params.get('scope') ?? ''
  const state = params.get('state') ?? ''
  const codeChallenge = params.get('code_challenge') ?? ''
  const codeChallengeMethod = params.get('code_challenge_method') ?? ''

  const [info, setInfo] = React.useState<AuthorizeInfo | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const buildQuery = React.useCallback(
    (extra: Record<string, string> = {}) => {
      const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
      })
      if (scope) q.set('scope', scope)
      if (codeChallenge) q.set('code_challenge', codeChallenge)
      if (codeChallengeMethod) q.set('code_challenge_method', codeChallengeMethod)
      for (const [k, v] of Object.entries(extra)) q.set(k, v)
      return q.toString()
    },
    [clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod],
  )

  React.useEffect(() => {
    if (!token) {
      useLoginDialogStore.getState().open('login', '/oauth/authorize')
      router.replace('/')
      return
    }
    if (!clientId || !redirectUri || !state) {
      setError('missing params')
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      const res = await fetchApi<AuthorizeInfo>(`/api/auth/oauth/authorize?${buildQuery()}`)
      if (cancelled) return
      if (!res.success) setError(res.error)
      else setInfo(res.data)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [token, clientId, redirectUri, state, buildQuery, router])

  const redirectTo = (url: string) => {
    if (typeof window !== 'undefined') window.location.href = url
  }

  const onApprove = async () => {
    setSubmitting(true)
    const res = await fetchApi<ApproveResult>(
      `/api/auth/oauth/authorize?${buildQuery({ approve: 'true' })}`,
    )
    setSubmitting(false)
    if (!res.success) {
      setError(res.error)
      return
    }
    const sep = redirectUri.includes('?') ? '&' : '?'
    redirectTo(`${redirectUri}${sep}code=${res.data.code}&state=${res.data.state}`)
  }

  const onDeny = () => {
    const sep = redirectUri.includes('?') ? '&' : '?'
    redirectTo(`${redirectUri}${sep}error=access_denied&state=${state}`)
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t('authorizeTitle')}
          </CardTitle>
          <CardDescription>
            {info ? t('authorizeDesc', { app: info.app.name }) : t('authorizeDesc', { app: '' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {info && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="font-medium">{info.app.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">{info.app.clientId}</span>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-medium">{t('scopes')}</h3>
            <ul className="space-y-2">
              {(info?.scopes ?? []).map((s) => (
                <li key={s.scope} className="flex items-start gap-2 rounded-md border px-3 py-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{s.name}</div>
                    {s.description && (
                      <div className="text-xs text-muted-foreground">{s.description}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onDeny}
              disabled={submitting}
            >
              {t('deny')}
            </Button>
            <Button type="button" className="flex-1" onClick={onApprove} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('approve')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthorizePage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AuthorizeContent />
    </React.Suspense>
  )
}
