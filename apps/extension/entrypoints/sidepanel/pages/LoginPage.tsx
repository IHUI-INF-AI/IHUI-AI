import { useState } from 'react'
import { loginByAccount, type LoginResult } from '@ihui/api-client'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

interface Props {
  onSuccess: (result: LoginResult) => void | Promise<void>
}

export default function LoginPage({ onSuccess }: Props) {
  const { t } = useI18n()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account || !password) {
      setError(t('login.requireInput'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await loginByAccount(account, password)
      if (res.success) {
        await onSuccess(res.data)
      } else {
        setError(res.error || t('login.loadFailed'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="sp-login">
      <Card>
        <CardHeader>
          <CardTitle>{t('login.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onLogin} className="sp-form">
            <div className="field">
              <Label htmlFor="sp-account">{t('login.account')}</Label>
              <Input
                id="sp-account"
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder={t('login.phoneOrEmailHint')}
                disabled={loading}
              />
            </div>
            <div className="field">
              <Label htmlFor="sp-password">{t('login.password')}</Label>
              <Input
                id="sp-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            {error ? <div className="error-banner">{error}</div> : null}
            <Button type="submit" disabled={loading}>
              {loading ? t('login.loading') : t('login.button')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
