'use client'

import { useState } from 'react'
import { AboutScreen } from '@ihui/rn-app'
import type { SharedAppInfo } from '@ihui/types'
import { useTranslations } from 'next-intl'

const MOCK_APP_INFO: SharedAppInfo = {
  appName: 'IHUI AI Demo',
  version: '1.0.0-demo',
  description: 'Demo for shared AboutScreen',
  officialSite: 'https://aizhs.top',
  contactEmail: 'support@aizhs.top',
  license: 'MIT',
}

export default function SharedDemoAboutPage() {
  const t = useTranslations()
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light')

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">共享 AboutScreen 验证</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          此页验证 @ihui/rn-app 的 AboutScreen 在 web 端的渲染(react-native-web alias),并验证 colorScheme 双主题切换。
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
        <AboutScreen
          t={(key: string) => t(key)}
          appInfo={MOCK_APP_INFO}
          onBack={() => window.history.back()}
          colorScheme={colorScheme}
        />
      </div>
    </div>
  )
}
