'use client'

import { useState } from 'react'
import { ProfileScreen, type SharedMenuSection, type SharedUserStatistics } from '@ihui/rn-app'
import type { SharedUser } from '@ihui/types'
import { useTranslations } from 'next-intl'

const MOCK_USER: SharedUser = {
  id: 'demo-1',
  nickname: 'Demo User',
  email: 'demo@ihui.ai',
}

const MOCK_STATS: SharedUserStatistics = {
  courseCount: 12,
  favoriteCount: 34,
  followingCount: 56,
  fansCount: 78,
  studyHours: 120,
  points: 1500,
}

const MOCK_MENU_SECTIONS: SharedMenuSection[] = [
  {
    title: '学习中心',
    items: [
      { key: 'courses', label: '我的课程', icon: '📚' },
      { key: 'favorites', label: '我的收藏', icon: '⭐' },
      { key: 'history', label: '浏览历史', icon: '🕐' },
    ],
  },
  {
    title: '账户与安全',
    items: [
      { key: 'wallet', label: '我的钱包', icon: '💰' },
      { key: 'orders', label: '我的订单', icon: '🧾' },
      { key: 'security', label: '安全设置', icon: '🔒' },
    ],
  },
]

export default function SharedDemoProfilePage() {
  const t = useTranslations()
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light')

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">共享 ProfileScreen 验证</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          此页验证 @ihui/rn-app 的 ProfileScreen 在 web 端的渲染(react-native-web alias)。
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
        <ProfileScreen
          t={(key: string) => t(key)}
          user={MOCK_USER}
          stats={MOCK_STATS}
          orderCount={8}
          loading={false}
          error=""
          menuSections={MOCK_MENU_SECTIONS}
          onNavigate={(key) => console.info('[shared-demo/profile] navigate:', key)}
          onLogout={() => console.info('[shared-demo/profile] logout')}
          onBack={() => window.history.back()}
          colorScheme={colorScheme}
        />
      </div>
    </div>
  )
}
