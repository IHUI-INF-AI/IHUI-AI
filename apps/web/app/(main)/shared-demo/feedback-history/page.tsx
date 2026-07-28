'use client'

import { useState } from 'react'
import {
  FeedbackHistoryScreen,
  type FeedbackHistoryItem,
} from '@ihui/rn-app'
import { useTranslations } from 'next-intl'

/**
 * /shared-demo/feedback-history — web 端共享 FeedbackHistoryScreen 验证页。
 *
 * 用 mock items 验证共享列表组件在 web 端的渲染(react-native-web alias)
 * + 下拉刷新 + 状态颜色映射(pending/resolved/closed)+ dark mode 切换。
 */
const MOCK_ITEMS: FeedbackHistoryItem[] = [
  {
    id: '1',
    type: 'bug',
    status: 'pending',
    content: '登录页面在 Safari 17 上点击按钮无响应,控制台报错 PointerEvent undefined',
    createdAt: '2026-07-28 10:23',
  },
  {
    id: '2',
    type: 'suggestion',
    status: 'resolved',
    content: '建议在设置页增加"导出聊天记录为 Markdown"的选项,方便用户备份',
    createdAt: '2026-07-26 14:08',
  },
  {
    id: '3',
    type: 'question',
    status: 'closed',
    content: '免费套餐是否支持自定义 Agent?如果升级到 VIP 才支持,门槛是什么?',
    createdAt: '2026-07-20 09:45',
  },
]

export default function SharedDemoFeedbackHistoryPage() {
  const t = useTranslations()
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light')
  const [refreshing, setRefreshing] = useState(false)
  const [items] = useState<FeedbackHistoryItem[]>(MOCK_ITEMS)

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 800)
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">共享 FeedbackHistoryScreen 验证</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          此页验证 @ihui/rn-app 的 FeedbackHistoryScreen 在 web 端的渲染(react-native-web alias)。
          覆盖列表 + 下拉刷新 + 状态颜色映射 + dark mode。
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
        <FeedbackHistoryScreen
          t={(key: string) => t(key)}
          items={items}
          loading={false}
          refreshing={refreshing}
          error=""
          onRefresh={handleRefresh}
          onPressItem={(id) => console.info('[shared-demo/feedback-history] press:', id)}
          onBack={() => window.history.back()}
          colorScheme={colorScheme}
        />
      </div>
    </div>
  )
}
