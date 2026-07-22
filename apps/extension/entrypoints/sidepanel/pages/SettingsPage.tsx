import { useOutletContext } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, Switch } from '@ihui/ui'
import { useState } from 'react'
import { useI18n, type Locale } from '../../../src/i18n'

interface Ctx {
  onLogout: () => void
}

const localeOptions: { value: Locale; labelKey: string }[] = [
  { value: 'zh-CN', labelKey: 'settings.zhCN' },
  { value: 'en', labelKey: 'settings.en' },
  { value: 'ja', labelKey: 'settings.ja' },
  { value: 'ko', labelKey: 'settings.ko' },
  { value: 'zh-TW', labelKey: 'settings.zhTW' },
]

export default function SettingsPage() {
  const { onLogout } = useOutletContext<Ctx>()
  const { locale, setLocale, t } = useI18n()
  // 深色模式切换:用 `.dark` class,与 web 端 globals.css 的 `@custom-variant dark` 机制一致。
  // 旧代码用 `data-theme` 属性,但 CSS 无规则响应,是 no-op BUG。
  const [dark, setDark] = useState(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  )

  const onToggleTheme = (v: boolean) => {
    setDark(v)
    document.documentElement.classList.toggle('dark', v)
  }

  return (
    <div className="sp-page">
      <div className="sp-page-header">
        <h3>{t('settings.title')}</h3>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.language')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="sp-setting-row">
            <span>{t('settings.language')}</span>
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
          <CardTitle>{t('settings.appearance')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="sp-setting-row">
            <span>{t('settings.darkMode')}</span>
            <Switch checked={dark} onCheckedChange={onToggleTheme} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.account')}</CardTitle>
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
