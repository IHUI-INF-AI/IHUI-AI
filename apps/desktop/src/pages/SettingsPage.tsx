import { useOutletContext } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, Switch } from '@ihui/ui'
import { clearToken } from '../lib/token'
import { useState } from 'react'
import { useI18n, type Locale } from '../i18n'

interface Ctx {
  onLogout: () => void
}

const localeOptions: { value: Locale; labelKey: string }[] = [
  { value: 'zh-CN', labelKey: 'setting.zhCN' },
  { value: 'en', labelKey: 'setting.en' },
  { value: 'ja', labelKey: 'setting.ja' },
  { value: 'ko', labelKey: 'setting.ko' },
  { value: 'zh-TW', labelKey: 'setting.zhTW' },
]

export default function SettingsPage() {
  const { onLogout } = useOutletContext<Ctx>()
  const { locale, setLocale, t } = useI18n()
  const [dark, setDark] = useState(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches,
  )

  const onToggleTheme = (v: boolean) => {
    setDark(v)
    document.documentElement.dataset.theme = v ? 'dark' : 'light'
  }

  const onClearCache = () => {
    if (!confirm(t('setting.clearCacheConfirm'))) return
    try {
      localStorage.clear()
      alert(t('setting.cacheCleared'))
    } catch {
      alert(t('setting.clearCacheFailed'))
    }
  }

  return (
    <div className="page page-settings">
      <header className="page-header">
        <h2>{t('nav.settings')}</h2>
      </header>
      <div className="settings-list">
        <Card>
          <CardHeader>
            <CardTitle>{t('setting.language')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="setting-row">
              <span>{t('setting.language')}</span>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="locale-select"
              >
                {localeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('setting.appearance')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="setting-row">
              <span>{t('setting.darkMode')}</span>
              <Switch checked={dark} onCheckedChange={onToggleTheme} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('setting.data')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="setting-row">
              <span>{t('setting.clearCache')}</span>
              <button type="button" onClick={onClearCache}>
                {t('common.delete')}
              </button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('setting.account')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="setting-row">
              <span>{t('auth.logout')}</span>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  clearToken()
                  onLogout()
                }}
              >
                {t('auth.logout')}
              </button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('setting.about')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="about">
              <p>{t('setting.desktopApp')}</p>
              <p className="muted">Tauri 2 + React + @ihui/ui + @ihui/api-client</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
