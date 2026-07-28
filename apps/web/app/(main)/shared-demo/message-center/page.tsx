'use client'

import { useState } from 'react'
import { MessageCenterScreen } from '@ihui/rn-app'
import { useTranslations } from 'next-intl'

type MessageTab = 'system' | 'order' | 'course' | 'social' | (string & {})

interface MessageCenterItem {
  id: string
  type: MessageTab
  title: string
  content: string
  read: boolean
  createdAt: string
}

const MOCK_ITEMS: MessageCenterItem[] = [
  { id: '1', type: 'system', title: '系统维护公告', content: '平台将于 2026-07-30 凌晨 2:00-4:00 维护升级', read: false, createdAt: '2026-07-28 09:00' },
  { id: '2', type: 'order', title: '订单支付成功', content: '订单 #20260728001 已支付 ¥299.00', read: false, createdAt: '2026-07-28 08:32' },
  { id: '3', type: 'course', title: '课程更新提醒', content: 'LangGraph 实战第 8 章已更新', read: true, createdAt: '2026-07-27 18:45' },
  { id: '4', type: 'social', title: '新粉丝关注', content: 'AI_Explorer 关注了你', read: true, createdAt: '2026-07-26 14:20' },
]

export default function SharedDemoMessageCenterPage() {
  const t = useTranslations()
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light')
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<MessageTab>('system')

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 800)
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">共享 MessageCenterScreen 验证</h1>
        <p className="mt-1 text-sm text-muted-foreground">此页验证 @ihui/rn-app 的 MessageCenterScreen 在 web 端的渲染(react-native-web alias)。</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setColorScheme('light')} className="rounded-md border px-3 py-1.5 text-sm">Light</button>
        <button type="button" onClick={() => setColorScheme('dark')} className="rounded-md border px-3 py-1.5 text-sm">Dark</button>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <MessageCenterScreen
          t={(key: string) => t(key)}
          items={MOCK_ITEMS}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          loading={false}
          refreshing={refreshing}
          error=""
          onRefresh={handleRefresh}
          onBack={() => window.history.back()}
          colorScheme={colorScheme}
        />
      </div>
    </div>
  )
}
