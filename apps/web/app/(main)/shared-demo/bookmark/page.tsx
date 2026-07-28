'use client'

import { useState } from 'react'
import { BookmarkScreen, type BookmarkItem } from '@ihui/rn-app'
import { useTranslations } from 'next-intl'

const MOCK_ITEMS: BookmarkItem[] = [
  { id: '1', targetId: 'c-101', targetType: 'course', title: 'TypeScript 高级类型实战:从泛型到条件类型的进阶之路', cover: null, createdAt: '2026-07-28 10:23' },
  { id: '2', targetId: 'a-202', targetType: 'article', title: 'React 19 并发渲染深度解析 - useTransition 与 useDeferredValue 的取舍', cover: null, createdAt: '2026-07-26 14:08' },
  { id: '3', targetId: 'p-303', targetType: 'post', title: '分享一个我用 LangGraph 构建的多 Agent 协作工作流(含完整代码)', cover: null, createdAt: '2026-07-20 09:45' },
  { id: '4', targetId: 'n-404', targetType: 'note', title: 'PostgreSQL 索引优化笔记 - 复合索引字段顺序的实战经验', cover: null, createdAt: '2026-07-18 16:32' },
]

export default function SharedDemoBookmarkPage() {
  const t = useTranslations()
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light')
  const [refreshing, setRefreshing] = useState(false)
  const [items, setItems] = useState<BookmarkItem[]>(MOCK_ITEMS)

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 800)
  }

  const handleRemove = (item: BookmarkItem) => {
    setItems((prev) => prev.filter((b) => b.id !== item.id))
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">共享 BookmarkScreen 验证</h1>
        <p className="mt-1 text-sm text-muted-foreground">此页验证 @ihui/rn-app 的 BookmarkScreen 在 web 端的渲染(react-native-web alias)。</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setColorScheme('light')} className="rounded-md border px-3 py-1.5 text-sm">Light</button>
        <button type="button" onClick={() => setColorScheme('dark')} className="rounded-md border px-3 py-1.5 text-sm">Dark</button>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <BookmarkScreen
          t={(key: string) => t(key)}
          items={items}
          loading={false}
          refreshing={refreshing}
          error=""
          onRefresh={handleRefresh}
          onPressItem={(item) => console.info('[shared-demo/bookmark] press:', item.id, item.targetType)}
          onRemove={handleRemove}
          onBack={() => window.history.back()}
          colorScheme={colorScheme}
        />
      </div>
    </div>
  )
}
