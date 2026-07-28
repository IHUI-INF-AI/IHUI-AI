'use client'

import { useState } from 'react'
import { OrderScreen, type OrderItem, type OrderTab } from '@ihui/rn-app'
import { useTranslations } from 'next-intl'

const MOCK_ITEMS: OrderItem[] = [
  { id: '1', orderNo: '20260728001', title: 'TypeScript 高级类型实战课程', amount: 299.0, status: 'paid', createdAt: '2026-07-28 08:32' },
  { id: '2', orderNo: '20260727002', title: 'LangGraph 多 Agent 工作流认证', amount: 599.0, status: 'completed', createdAt: '2026-07-27 14:20' },
  { id: '3', orderNo: '20260726003', title: 'PostgreSQL 索引优化专项', amount: 199.0, status: 'pending', createdAt: '2026-07-26 09:45' },
  { id: '4', orderNo: '20260725004', title: 'React 19 并发渲染深度解析', amount: 399.0, status: 'cancelled', createdAt: '2026-07-25 16:08' },
]

export default function SharedDemoOrderPage() {
  const t = useTranslations()
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light')
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<OrderTab>('all')
  const [items] = useState<OrderItem[]>(MOCK_ITEMS)

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 800)
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">共享 OrderScreen 验证</h1>
        <p className="mt-1 text-sm text-muted-foreground">此页验证 @ihui/rn-app 的 OrderScreen 在 web 端的渲染(react-native-web alias)。</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setColorScheme('light')} className="rounded-md border px-3 py-1.5 text-sm">Light</button>
        <button type="button" onClick={() => setColorScheme('dark')} className="rounded-md border px-3 py-1.5 text-sm">Dark</button>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <OrderScreen
          t={(key: string) => t(key)}
          items={items}
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          loading={false}
          refreshing={refreshing}
          error=""
          onRefresh={handleRefresh}
          onPressItem={(item) => console.info('[shared-demo/order] press:', item.id, item.orderNo)}
          onBack={() => window.history.back()}
          colorScheme={colorScheme}
        />
      </div>
    </div>
  )
}
