'use client'

import { useState } from 'react'
import { HistoryScreen } from '@ihui/rn-app'
import { useTranslations } from 'next-intl'

type HistoryTargetType = 'course' | 'article' | 'post' | 'note' | 'live' | string

interface HistoryItem {
  id: string
  targetId: string
  targetType: HistoryTargetType
  title: string
  visitedAt: string
}

const MOCK_ITEMS: HistoryItem[] = [
  { id: '1', targetId: 'c-501', targetType: 'course', title: 'React 19 新特性深度解析 - Actions 与 useActionState', visitedAt: '2026-07-28 11:23' },
  { id: '2', targetId: 'a-602', targetType: 'article', title: 'TypeScript 5.7 装饰器实战:从 IoC 容器到依赖注入', visitedAt: '2026-07-27 16:08' },
  { id: '3', targetId: 'p-703', targetType: 'post', title: '分享我搭建 AI Agent 工作流的 5 个踩坑经验(附解决方案)', visitedAt: '2026-07-26 09:45' },
  { id: '4', targetId: 'l-804', targetType: 'live', title: '直播回放:从 0 到 1 构建企业级 RAG 系统的完整流程', visitedAt: '2026-07-25 20:32' },
]

export default function SharedDemoHistoryPage() {
  const t = useTranslations()
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light')
  const [refreshing, setRefreshing] = useState(false)
  const [items] = useState<HistoryItem[]>(MOCK_ITEMS)

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 800)
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">共享 HistoryScreen 验证</h1>
        <p className="mt-1 text-sm text-muted-foreground">此页验证 @ihui/rn-app 的 HistoryScreen 在 web 端的渲染(react-native-web alias)。</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setColorScheme('light')} className="rounded-md border px-3 py-1.5 text-sm">Light</button>
        <button type="button" onClick={() => setColorScheme('dark')} className="rounded-md border px-3 py-1.5 text-sm">Dark</button>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <HistoryScreen
          t={(key: string) => t(key)}
          items={items}
          loading={false}
          refreshing={refreshing}
          error=""
          onRefresh={handleRefresh}
          onPressItem={(item) => console.info('[shared-demo/history] press:', item.id, item.targetType)}
          onBack={() => window.history.back()}
          colorScheme={colorScheme}
        />
      </div>
    </div>
  )
}
