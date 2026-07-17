import { useState } from 'react'
import { loginByAccount, type LoginResult } from '@ihui/api-client'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ihui/ui'

interface Props {
  onSuccess: (result: LoginResult) => void | Promise<void>
}

export default function LoginPage({ onSuccess }: Props) {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
        await onSuccess(res.data)
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
    <div className="sp-login">
      <Card>
        <CardHeader>
          <CardTitle>登录 IHUI AI</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onLogin} className="sp-form">
            <div className="field">
              <Label htmlFor="sp-account">账号</Label>
              <Input
                id="sp-account"
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="手机号 / 邮箱"
                disabled={loading}
              />
            </div>
            <div className="field">
              <Label htmlFor="sp-password">密码</Label>
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
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
