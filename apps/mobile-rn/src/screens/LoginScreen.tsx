import { useState } from 'react'
import { LoginScreen as SharedLoginScreen } from '@ihui/rn-app'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'

export function LoginScreen() {
  const { t } = useI18n()
  const { login, loginBySso } = useAuth()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!account || !password) { setError('请输入账号和密码'); return }
    setLoading(true); setError('')
    const res = await login(account, password)
    if (!res.success) setError(res.error ?? '登录失败')
    setLoading(false)
  }

  const handleSsoLogin = async () => {
    setSsoLoading(true); setError('')
    const res = await loginBySso()
    if (!res.success) setError(res.error ?? 'SSO 登录失败')
    setSsoLoading(false)
  }

  return (
    <SharedLoginScreen
      t={t}
      account={account}
      password={password}
      loading={loading}
      ssoLoading={ssoLoading}
      error={error}
      onAccountChange={setAccount}
      onPasswordChange={setPassword}
      onLogin={handleLogin}
      onSsoLogin={handleSsoLogin}
    />
  )
}
