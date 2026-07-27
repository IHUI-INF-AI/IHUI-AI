'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Button, Input, Label } from '@ihui/ui-react'
import { useAuthStore, type AuthUser } from '@/stores/auth'
import { fetchApi } from '@/lib/api'
import { Alert } from '@/components/feedback'
import { AgreementCheckbox } from '@/components/auth/AgreementCheckbox'
import { PasswordInput } from '@/components/login'
import { usernameSchema } from './login-schemas'
import { loginByUsername } from '@ihui/api-client'

interface UsernameLoginFormProps {
  active: boolean
  onSuccess?: () => void
  agreed?: boolean
  onAgreedChange?: (v: boolean) => void
  onRequireAgree?: () => void
  showAgreeErr?: boolean
}

export function UsernameLoginForm({
  active,
  onSuccess,
  agreed = true,
  onAgreedChange,
  onRequireAgree,
  showAgreeErr,
}: UsernameLoginFormProps) {
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
    if (!agreed) {
      onRequireAgree?.()
      return
    }
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
      const r = await loginByUsername(username, usernamePassword)
      if (!r.success || !r.data?.accessToken) {
        setUsernameErr(r.error || t('invalidCredentials'))
        return
      }
      setToken(r.data.accessToken, r.data.refreshToken)
      const u = r.data.user
      if (u?.id) {
        setUser({ id: u.id, nickname: u.nickname ?? '' })
        void fetchApi<{ user: AuthUser }>('/api/auth/me').then((rr) => {
          if (rr.success) setUser(rr.data.user)
        }).catch(() => {})
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
      <div className="space-y-1.5">
        <Label htmlFor="username">{t('username')}</Label>
        <Input
          id="username"
          autoComplete="username"
          placeholder={t('usernamePlaceholder')}
          className="h-10"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="username-password">{t('password')}</Label>
        <PasswordInput
          id="username-password"
          autoComplete="current-password"
          placeholder={t('passwordPlaceholder')}
          className="h-10"
          value={usernamePassword}
          onChange={(e) => setUsernamePassword(e.target.value)}
        />
      </div>
      <AgreementCheckbox
        checked={agreed}
        onChange={(v) => onAgreedChange?.(v)}
        error={showAgreeErr && !agreed}
      />
      {showAgreeErr && !agreed && <p className="text-xs text-destructive">{t('agreeRequired')}</p>}
      <Button type="submit" className="h-10 w-full" disabled={usernameSubmitting || !agreed}>
        {usernameSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('loginBtn')}
      </Button>
    </form>
  )
}
