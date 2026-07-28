'use client'

import { useState } from 'react'
import { CourseCatalogScreen, type CourseCatalogItem } from '@ihui/rn-app'
import { useTranslations } from 'next-intl'

const MOCK_ITEMS: CourseCatalogItem[] = [
  {
    id: '1',
    title: 'TypeScript 高级类型实战',
    type: '视频',
    duration: 32,
  },
  {
    id: '2',
    title: 'LangGraph 多 Agent 工作流编排',
    type: '视频',
    duration: 45,
  },
  {
    id: '3',
    title: 'PostgreSQL 索引优化与执行计划',
    type: '图文',
    duration: 20,
  },
  {
    id: '4',
    title: 'React 19 并发渲染与 Suspense 深度解析',
    type: '直播',
    duration: 90,
  },
  {
    id: '5',
    title: 'Drizzle ORM 0.38 schema 迁移实战',
    type: '视频',
    duration: 28,
  },
]

type DemoState = 'normal' | 'loading' | 'error' | 'empty'

export default function SharedDemoCourseCatalogPage() {
  const t = useTranslations()
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light')
  const [demoState, setDemoState] = useState<DemoState>('normal')

  const items = demoState === 'empty' || demoState === 'loading' ? [] : MOCK_ITEMS
  const loading = demoState === 'loading'
  const error = demoState === 'error' ? t('courseCatalog.loadFailed') : ''

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">共享 CourseCatalogScreen 验证</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          此页验证 @ihui/rn-app 的 CourseCatalogScreen 在 web 端的渲染(react-native-web alias)。
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
        <span className="mx-2 text-xs text-muted-foreground">|</span>
        {(['normal', 'loading', 'error', 'empty'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setDemoState(s)}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border">
        <CourseCatalogScreen
          t={(key: string, params?: Record<string, string | number>) =>
            params ? t(key, params) : t(key)
          }
          items={items}
          loading={loading}
          error={error}
          onPressItem={(item) =>
            console.info('[shared-demo/course-catalog] press:', item.id, item.title)
          }
          onBack={() => window.history.back()}
          colorScheme={colorScheme}
        />
      </div>
    </div>
  )
}
