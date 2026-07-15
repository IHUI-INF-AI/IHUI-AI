import { useEffect, useState } from 'react'
import { fetchApi } from '@ihui/api-client'
import { initApi, setToken, getToken } from '../../lib/token'

interface TokenPayload {
  accessToken: string
  user: { id: string; username: string; nickname: string; avatar: string | null }
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    initApi().then(() => {
      setLoggedIn(!!getToken())
      setReady(true)
    })
  }, [])

  const handleLogin = async () => {
    if (!account || !password) {
      setError('请输入账号和密码')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi<TokenPayload>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ account, password }),
      })
      if (res.success) {
        await setToken(res.data.accessToken)
        setLoggedIn(true)
      } else {
        setError(res.error)
      }
    } catch {
      setError('网络异常')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await setToken(null)
    setLoggedIn(false)
    setAccount('')
    setPassword('')
  }

  if (!ready) {
    return <div style={{ padding: 24, textAlign: 'center' }}>加载中...</div>
  }

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 18, margin: '0 0 16px' }}>IHUI AI 助手</h1>
      {loggedIn ? (
        <div>
          <p style={{ color: '#16a34a', marginBottom: 12 }}>已登录</p>
          <button onClick={handleLogout} style={{ padding: '6px 12px', cursor: 'pointer' }}>
            退出登录
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text"
            placeholder="账号 / 手机号 / 邮箱"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
          />
          {error && <p style={{ color: '#dc2626', margin: 0, fontSize: 13 }}>{error}</p>}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              padding: 8,
              borderRadius: 4,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </div>
      )}
    </div>
  )
}
