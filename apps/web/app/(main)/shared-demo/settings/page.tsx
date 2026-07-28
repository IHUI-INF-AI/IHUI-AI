'use client'

import { useState } from 'react'
import {
  SettingsScreen,
  type SharedLocaleOption,
  type SharedMenuItem,
  type SharedThemeOption,
  type SharedNotificationToggles,
} from '@ihui/rn-app'
import type { SharedUser } from '@ihui/types'
import { useTranslations } from 'next-intl'

const MOCK_USER: SharedUser = {
  id: 'demo-1',
  nickname: 'Demo User',
  email: 'demo@ihui.ai',
}

const MOCK_LOCALE_OPTIONS: SharedLocaleOption[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'zh-TW', label: '繁體中文' },
]

const MOCK_THEME_OPTIONS: SharedThemeOption[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
]

const MOCK_MENU_ITEMS: SharedMenuItem[] = [
  { key: 'account', label: '账户资料' },
  { key: 'security', label: '安全设置' },
  { key: 'api', label: 'API 密钥' },
  { key: 'about', label: '关于我们' },
]

export default function SharedDemoSettingsPage() {
  const t = useTranslations()
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light')
  const [locale, setLocale] = useState('zh-CN')
  const [theme, setTheme] = useState('light')
  const [notifications, setNotifications] = useState<SharedNotificationToggles>({
    push: true,
    message: true,
    email: false,
  })

  const handleToggleNotification = (key: keyof SharedNotificationToggles, value: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: value }))
    console.info('[shared-demo/settings] toggle:', key, value)
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">共享 SettingsScreen 验证</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          此页验证 @ihui/rn-app 的 SettingsScreen 在 web 端的渲染(react-native-web alias)。
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setColorScheme('light')}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          Light
        </button>
        <button
          type="button"
          onClick={() => setColorScheme('dark')}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          Dark
        </button>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <SettingsScreen
          t={(key: string) => t(key)}
          user={MOCK_USER}
          locale={locale}
          localeOptions={MOCK_LOCALE_OPTIONS}
          onSelectLocale={(value) => {
            setLocale(value)
            console.info('[shared-demo/settings] locale:', value)
          }}
          theme={theme}
          themeOptions={MOCK_THEME_OPTIONS}
          onSelectTheme={(value) => {
            setTheme(value)
            console.info('[shared-demo/settings] theme:', value)
          }}
          notifications={notifications}
          onToggleNotification={handleToggleNotification}
          onEditProfile={() => console.info('[shared-demo/settings] edit profile')}
          onChangePassword={async (oldPwd, newPwd) => {
            console.info('[shared-demo/settings] change password:', { oldPwd, newPwd })
            return true
          }}
          onAlert={(title, message) => console.info('[shared-demo/settings] alert:', title, message)}
          onConfirm={(title, message, onOk) => {
            console.info('[shared-demo/settings] confirm:', title, message)
            onOk()
          }}
          onLogout={() => console.info('[shared-demo/settings] logout')}
          menuItems={MOCK_MENU_ITEMS}
          onMenuPress={(key) => console.info('[shared-demo/settings] menu:', key)}
          appVersion="1.0.0-demo"
          onBack={() => window.history.back()}
          colorScheme={colorScheme}
        />
      </div>
    </div>
  )
}
