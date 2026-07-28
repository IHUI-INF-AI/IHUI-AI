'use client'

import { useState } from 'react'
import { WalletScreen, type WalletBalance } from '@ihui/rn-app'
import { useTranslations } from 'next-intl'

const MOCK_BALANCE: WalletBalance = {
  balance: 1286.5,
  frozenBalance: 100.0,
  totalRecharge: 5000.0,
  totalWithdraw: 1200.0,
}

export default function SharedDemoWalletPage() {
  const t = useTranslations()
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light')
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 800)
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">共享 WalletScreen 验证</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          此页验证 @ihui/rn-app 的 WalletScreen 在 web 端的渲染(react-native-web alias)。
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
        <button
          type="button"
          onClick={handleRefresh}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          刷新
        </button>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <WalletScreen
          t={(key: string) => t(key)}
          balance={MOCK_BALANCE}
          loading={refreshing}
          error=""
          onRefresh={handleRefresh}
          onAction={(action) => console.info('[shared-demo/wallet] action:', action)}
          onBack={() => window.history.back()}
          colorScheme={colorScheme}
        />
      </div>
    </div>
  )
}
