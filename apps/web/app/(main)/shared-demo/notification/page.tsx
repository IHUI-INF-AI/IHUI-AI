'use client'

import { useState } from 'react'
import { NotificationListScreen, type NotificationListItem } from '@ihui/rn-app'
import { useTranslations } from 'next-intl'

const MOCK_ITEMS: NotificationListItem[] = [
  {
    id: '1',
    type: 'system',
    title: '系统升级公告',
    content: '平台将于 2026-07-30 凌晨 2:00-4:00 进行维护升级,期间无法访问',
    read: false,
    createdAt: '2026-07-28 09:00',
  },
  {
    id: '2',
    type: 'order',
    title: '订单支付成功',
    content: '您的订单 #20260728001 已支付成功,金额 ¥299.00',
    read: false,
    createdAt: '2026-07-28 08:32',
  },
  {
    id: '3',
    type: 'course',
    title: '新课程上架提醒',
    content: '您关注的「LangGraph 实战」系列课程已更新第 8 章',
    read: true,
    createdAt: '2026-07-27 18:45',
  },
  {
    id: '4',
    type: 'social',
    title: '有人关注了你',
    content: '用户 AI_Explorer 开始关注你,快去看看 ta 的主页吧',
    read: true,
    createdAt: '2026-07-26 14:20',
  },
]

export default function SharedDemoNotificationPage() {
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
        <h1 className="text-xl font-bold tracking-tight">共享 NotificationListScreen 验证</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          此页验证 @ihui/rn-app 的 NotificationListScreen 在 web 端的渲染(react-native-web alias)。
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
        <NotificationListScreen
          t={(key: string) => t(key)}
          items={MOCK_ITEMS}
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
