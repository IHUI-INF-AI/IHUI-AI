import { useEffect, useState } from 'react'
import { loginByAccount, getMe, logout, type AuthUser } from '@ihui/api-client'
import { initApi, setTokenPair, getToken, getRefreshToken, clearAllTokens } from '../../lib/token'
import { startAutoRefresh, scheduleRefreshAlarm } from '../../lib/token-utils'
import { useI18n } from '../../src/i18n'

export default function App() {
  const { t } = useI18n()
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
        else await clearAllTokens()
      }
      setReady(true)
    })
    startAutoRefresh()
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
      await setTokenPair({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        expiresIn: res.data.expiresIn,
      })
      scheduleRefreshAlarm(res.data.accessToken)
      startAutoRefresh()
      setUser(res.data.user)
    } else {
      setError(res.error || `${t('auth.login')}${t('common.failed')}`)
    }
    setLoading(false)
  }

  const onLogout = async () => {
    await logout(getRefreshToken() || '')
    await clearAllTokens()
    setUser(null)
  }

  const openSidePanel = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      if (tabId) chrome.sidePanel.open({ tabId })
    })
  }

  if (!ready) {
    return <div className="popup-loading">{t('common.loading')}</div>
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
            {loading ? t('common.loading') : t('auth.login')}
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
        {t('nav.chat')}
      </button>
      <button type="button" className="btn btn-logout" onClick={onLogout}>
        {t('auth.logout')}
      </button>
    </div>
  )
}
