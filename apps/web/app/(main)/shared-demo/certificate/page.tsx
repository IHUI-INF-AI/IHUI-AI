'use client'

import { useState } from 'react'
import { CertificateScreen } from '@ihui/rn-app'
import { useTranslations } from 'next-intl'

interface CertificateItem {
  id: string
  title: string
  courseName: string
  issueDate: string
  expiryDate: string | null
  status: 'issued' | 'expired' | 'revoked' | string
}

const MOCK_ITEMS: CertificateItem[] = [
  { id: '1', title: '完成 TypeScript 高级类型实战课程', courseName: 'TypeScript 高级类型实战', issueDate: '2026-07-15', expiryDate: '2027-07-15', status: 'issued' },
  { id: '2', title: 'LangGraph 多 Agent 协作工作流认证', courseName: 'LangGraph 实战', issueDate: '2026-06-20', expiryDate: '2027-06-20', status: 'issued' },
  { id: '3', title: 'PostgreSQL 索引优化专项证书', courseName: 'PostgreSQL 性能优化', issueDate: '2025-08-10', expiryDate: '2026-08-10', status: 'expired' },
  { id: '4', title: 'React 19 并发渲染深度解析认证', courseName: 'React 19 进阶', issueDate: '2026-07-25', expiryDate: '2027-07-25', status: 'issued' },
]

export default function SharedDemoCertificatePage() {
  const t = useTranslations()
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light')
  const [refreshing, setRefreshing] = useState(false)
  const [items, setItems] = useState<CertificateItem[]>(MOCK_ITEMS)

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
      setItems([...MOCK_ITEMS])
    }, 800)
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">共享 CertificateScreen 验证</h1>
        <p className="mt-1 text-sm text-muted-foreground">此页验证 @ihui/rn-app 的 CertificateScreen 在 web 端的渲染(react-native-web alias)。</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setColorScheme('light')} className="rounded-md border px-3 py-1.5 text-sm">Light</button>
        <button type="button" onClick={() => setColorScheme('dark')} className="rounded-md border px-3 py-1.5 text-sm">Dark</button>
        <button type="button" onClick={handleRefresh} className="rounded-md border px-3 py-1.5 text-sm">刷新</button>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <CertificateScreen
          t={(key: string) => t(key)}
          items={items}
          loading={false}
          refreshing={refreshing}
          error=""
          onRefresh={handleRefresh}
          onPressItem={(item) => console.info('[shared-demo/certificate] press:', item.id, item.status)}
          onBack={() => window.history.back()}
          colorScheme={colorScheme}
        />
      </div>
    </div>
  )
}
