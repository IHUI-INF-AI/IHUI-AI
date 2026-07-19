/**
 * Popup — 登录入口 + 用户信息 + 快捷操作(打开侧边栏 / 收藏 / 通知 / 复制 URL / 打开网页版)。
 *
 * 快捷操作依赖 background 通过 message-router 提供的 api.proxy + sidePanel.open 能力。
 */
import { useEffect, useState } from 'react'
import { loginByAccount, getMe, logout, type AuthUser } from '@ihui/api-client'
import { initApi, setTokenPair, getToken, getRefreshToken, clearAllTokens } from '../../lib/token'
import { startAutoRefresh, scheduleRefreshAlarm } from '../../lib/token-utils'
import { useI18n } from '../../src/i18n'
import { sendMessage } from '../../lib/message-router'
import { QuickActionButton } from '../components/QuickActionButton'
import { NotificationBell } from '../components/NotificationBell'

interface ActiveTab {
  tabId?: number
  url?: string
  title?: string
}

export default function App() {
  const { t } = useI18n()
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null)
  const [copyHint, setCopyHint] = useState('')

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

    // 查询当前 tab(用于"复制 URL" / "打赏作者" 等)
    void sendMessage<ActiveTab>({
      type: 'tab.queryActive',
      payload: undefined,
      requestId: `tab-${Date.now()}`,
    })
      .then((res) => setActiveTab(res))
      .catch(() => setActiveTab(null))
  }, [])

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account || !password) {
      setError(t('auth.loginRequired'))
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

  const openSidePanel = async (route: string = '/chat') => {
    try {
      const res = await sendMessage<{ opened: boolean }>({
        type: 'sidePanel.open',
        payload: { tabId: activeTab?.tabId },
        requestId: `sp-${Date.now()}`,
      })
      if (res?.opened && route !== '/chat') {
        // 写入待跳转路由(sidepanel 启动时检测)
        await chrome.storage.session?.set({ ihui_pending_route: route })
      }
    } catch (err) {
      console.warn('[IHUI AI] open side panel failed:', err)
    }
    window.close()
  }

  const copyPageUrl = async () => {
    const url = activeTab?.url
    if (!url) {
      setCopyHint(t('popup.copyFailed'))
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopyHint(t('popup.copySuccess'))
    } catch {
      setCopyHint(t('popup.copyFailed'))
    }
    setTimeout(() => setCopyHint(''), 2000)
  }

  const openWeb = () => {
    const url = 'https://www.ihui.ai/'
    chrome.tabs.create({ url })
    window.close()
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
            placeholder={t('auth.phoneOrEmail')}
            className="input"
            disabled={loading}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.password')}
            className="input"
            disabled={loading}
          />
          {error ? <div className="error">{error}</div> : null}
          <button type="submit" className="btn" disabled={loading}>
            {loading ? t('common.loading') : t('auth.login')}
          </button>
        </form>
        <QuickActionButton
          label={t('popup.openWeb')}
          icon="🌐"
          onClick={openWeb}
          variant="default"
        />
      </div>
    )
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <div className="user-info">
          <div className="avatar">{user.nickname?.[0] || user.phone?.[0] || '?'}</div>
          <div className="user-detail">
            <div className="nickname">{user.nickname || user.phone}</div>
            <div className="role">
              {(user.roleId ?? 0) >= 1 ? t('auth.roleAdmin') : t('auth.roleUser')}
            </div>
          </div>
        </div>
        <NotificationBell />
      </div>
      <div className="popup-section">
        <div className="popup-section-title">{t('popup.quickActions')}</div>
        <div className="popup-actions">
          <QuickActionButton
            label={t('popup.openChat')}
            icon="💬"
            onClick={() => openSidePanel('/chat')}
            variant="primary"
          />
          <QuickActionButton
            label={t('popup.openSidePanel')}
            icon="📌"
            onClick={() => openSidePanel('/chat')}
          />
          <QuickActionButton
            label={t('nav.vocabulary')}
            icon="📖"
            onClick={() => openSidePanel('/vocabulary')}
          />
          <QuickActionButton
            label={t('nav.profile')}
            icon="👤"
            onClick={() => openSidePanel('/profile')}
          />
          <QuickActionButton
            label={t('nav.wallet')}
            icon="💰"
            onClick={() => openSidePanel('/wallet')}
          />
          <QuickActionButton
            label={copyHint || (activeTab?.url ? `${t('popup.copySuccess')} URL` : '—')}
            icon="🔗"
            onClick={copyPageUrl}
            disabled={!activeTab?.url}
          />
          <QuickActionButton
            label={t('popup.openWeb')}
            icon="🌐"
            onClick={openWeb}
            variant="default"
          />
        </div>
      </div>
      <button type="button" className="btn btn-logout" onClick={onLogout}>
        {t('auth.logout')}
      </button>
    </div>
  )
}
