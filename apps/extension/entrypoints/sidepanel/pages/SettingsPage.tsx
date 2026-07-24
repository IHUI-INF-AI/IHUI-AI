import { useOutletContext } from 'react-router-dom'
import { Button, Card, CardContent, CardHeader, CardTitle, Switch } from '@ihui/ui-react'
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
  const [dark, setDark] = useState(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  )

  const onToggleTheme = (v: boolean) => {
    setDark(v)
    document.documentElement.classList.toggle('dark', v)
  }

  return (
    <div className="p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('settings.title')}</h3>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.language')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2">
            <span>{t('settings.language')}</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              className="text-xs text-foreground px-2 py-1 border border-border rounded-md bg-card cursor-pointer transition-colors hover:border-muted-foreground focus:outline-none focus:border-muted-foreground"
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
          <div className="flex items-center justify-between gap-2">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="bg-destructive/10 text-destructive border-destructive w-full"
          >
            {t('auth.logout')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
