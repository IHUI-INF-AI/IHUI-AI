import { useEffect, useState } from 'react'
import { loginByAccount, getMe, type AuthUser } from '@ihui/api-client'
import { initApi, setToken, getToken, clearToken } from '../../lib/token'

export default function App() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    initApi().then(async () => {
      if (getToken()) {
        const res = await getMe()
        if (res.success) setUser(res.data.user)
        else clearToken()
      }
      setReady(true)
    })
  }, [])

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account || !password) {
      setError('请输入账号和密码')
      return
    }
    setLoading(true)
    setError('')
    const res = await loginByAccount(account, password)
    if (res.success) {
      await setToken(res.data.accessToken)
      setUser(res.data.user)
    } else {
      setError(res.error || '登录失败')
    }
    setLoading(false)
  }

  const onLogout = async () => {
    clearToken()
    setUser(null)
  }

  const openSidePanel = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      if (tabId) chrome.sidePanel.open({ tabId })
    })
  }

  if (!ready) {
    return <div className="popup-loading">加载中...</div>
  }

  if (!user) {
    return (
      <div className="popup-container">
        <h1 className="popup-title">IHUI AI</h1>
        <form onSubmit={onLogin} className="login-form">
          <input
            type="text"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="手机号 / 邮箱"
            className="input"
            disabled={loading}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            className="input"
            disabled={loading}
          />
          {error ? <div className="error">{error}</div> : null}
          <button type="submit" className="btn" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="popup-container">
      <div className="user-info">
        <div className="avatar">{user.nickname?.[0] || user.phone?.[0] || '?'}</div>
        <div className="user-detail">
          <div className="nickname">{user.nickname || user.phone}</div>
          <div className="role">{(user.roleId ?? 0) >= 1 ? '管理员' : '用户'}</div>
        </div>
      </div>
      <button type="button" className="btn" onClick={openSidePanel}>
        打开 AI 对话
      </button>
      <button type="button" className="btn btn-logout" onClick={onLogout}>
        退出登录
      </button>
    </div>
  )
}
