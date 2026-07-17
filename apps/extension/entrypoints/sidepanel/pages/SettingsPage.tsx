import { useOutletContext } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, Switch } from '@ihui/ui'
import { useState } from 'react'
import { useI18n, type Locale } from '../../../src/i18n'

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

  return (
    <div className="sp-page">
      <div className="sp-page-header">
        <h3>{t('setting.title')}</h3>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('setting.language')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="sp-setting-row">
            <span>{t('setting.language')}</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              className="sp-locale-select"
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
          <div className="sp-setting-row">
            <span>{t('setting.darkMode')}</span>
            <Switch checked={dark} onCheckedChange={onToggleTheme} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('setting.account')}</CardTitle>
        </CardHeader>
        <CardContent>
          <button type="button" onClick={onLogout} className="sp-danger-btn">
            {t('auth.logout')}
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
