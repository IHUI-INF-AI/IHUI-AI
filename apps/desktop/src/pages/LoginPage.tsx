import { useEffect, useState } from 'react'
import { loginByAccount } from '@ihui/api-client'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ihui/ui'
import { setToken, setRefreshToken } from '../lib/token'

export default function LoginPage() {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'IHUI AI 桌面端 - 登录'
  }, [])

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account || !password) {
      setError('请输入账号和密码')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await loginByAccount(account, password)
      if (res.success) {
        setToken(res.data.accessToken)
        setRefreshToken(res.data.refreshToken)
        window.location.assign('/')
      } else {
        setError(res.error || '登录失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <Card className="login-card">
        <CardHeader>
          <CardTitle>IHUI AI 桌面端</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onLogin} className="login-form">
            <div className="field">
              <Label htmlFor="account">账号</Label>
              <Input
                id="account"
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="手机号 / 邮箱 / 用户名"
                autoComplete="username"
                disabled={loading}
              />
            </div>
            <div className="field">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
            {error ? <div className="error-banner">{error}</div> : null}
            <Button type="submit" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
