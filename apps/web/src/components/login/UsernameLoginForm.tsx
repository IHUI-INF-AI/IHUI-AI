'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Button, Input, Label } from '@ihui/ui'
import { useAuthStore, type AuthUser } from '@/stores/auth'
import { fetchApi } from '@/lib/api'
import { Alert } from '@/components/feedback'
import { usernameSchema, type TokenResult } from './login-schemas'

interface UsernameLoginFormProps {
  active: boolean
  onSuccess?: () => void
}

export function UsernameLoginForm({ active, onSuccess }: UsernameLoginFormProps) {
  const t = useTranslations('auth')
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)

  const [username, setUsername] = React.useState('')
  const [usernamePassword, setUsernamePassword] = React.useState('')
  const [usernameErr, setUsernameErr] = React.useState<string | null>(null)
  const [usernameSubmitting, setUsernameSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!active) setUsernameErr(null)
  }, [active])

  const onUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUsernameErr(null)
    const up = usernameSchema.safeParse(username)
    if (!up.success) {
      setUsernameErr(t('invalidUsername'))
      return
    }
    if (usernamePassword.length < 6) {
      setUsernameErr(t('invalidPassword'))
      return
    }
    setUsernameSubmitting(true)
    try {
      const res = await fetch('/api/auth/login/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: usernamePassword }),
      })
      const json = (await res.json()) as { code: number; message: string; data?: TokenResult }
      if (!res.ok || json.code !== 0 || !json.data?.accessToken) {
        setUsernameErr(json.message || t('invalidCredentials'))
        return
      }
      setToken(json.data.accessToken, json.data.refreshToken)
      if (json.data.userId) {
        setUser({ id: json.data.userId, nickname: '' })
        void fetchApi<{ user: AuthUser }>('/api/auth/me').then((r) => {
          if (r.success) setUser(r.data.user)
        })
      }
      onSuccess?.()
    } catch {
      setUsernameErr(t('loginFailed'))
    } finally {
      setUsernameSubmitting(false)
    }
  }

  return (
    <form onSubmit={onUsernameSubmit} className="space-y-4 pt-2">
      {usernameErr && <Alert variant="danger" description={usernameErr} />}
      <div className="space-y-2">
        <Label htmlFor="username">{t('username')}</Label>
        <Input
          id="username"
          autoComplete="username"
          placeholder={t('usernamePlaceholder')}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="username-password">{t('password')}</Label>
        <Input
          id="username-password"
          type="password"
          autoComplete="current-password"
          placeholder={t('passwordPlaceholder')}
          value={usernamePassword}
          onChange={(e) => setUsernamePassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={usernameSubmitting}>
        {usernameSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('loginBtn')}
      </Button>
    </form>
  )
}
