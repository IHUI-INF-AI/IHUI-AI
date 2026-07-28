'use client'

import { useState } from 'react'
import { StudyPlanScreen, type StudyPlanItem } from '@ihui/rn-app'
import { useTranslations } from 'next-intl'

const MOCK_ITEMS: StudyPlanItem[] = [
  {
    id: '1',
    title: 'TypeScript 高级类型掌握计划',
    courseName: 'TypeScript 高级类型实战',
    totalLessons: 24,
    completedLessons: 18,
    progress: 75,
    status: 'active',
    deadline: '2026-08-15',
  },
  {
    id: '2',
    title: 'LangGraph 工作流应用计划',
    courseName: 'LangGraph 实战',
    totalLessons: 16,
    completedLessons: 16,
    progress: 100,
    status: 'completed',
    deadline: '2026-07-20',
  },
  {
    id: '3',
    title: 'PostgreSQL 性能优化专精',
    courseName: 'PostgreSQL 性能优化',
    totalLessons: 20,
    completedLessons: 5,
    progress: 25,
    status: 'paused',
    deadline: '2026-09-30',
  },
  {
    id: '4',
    title: 'React 19 进阶实战',
    courseName: 'React 19 进阶',
    totalLessons: 18,
    completedLessons: 12,
    progress: 67,
    status: 'overdue',
    deadline: '2026-07-25',
  },
]

export default function SharedDemoStudyPlanPage() {
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
        <h1 className="text-xl font-bold tracking-tight">共享 StudyPlanScreen 验证</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          此页验证 @ihui/rn-app 的 StudyPlanScreen 在 web 端的渲染(react-native-web alias)。
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
        <StudyPlanScreen
          t={(key: string) => t(key)}
          items={MOCK_ITEMS}
          loading={false}
          refreshing={refreshing}
          error=""
          onRefresh={handleRefresh}
          onPressItem={(item) =>
            console.info('[shared-demo/study-plan] press:', item.id, item.status)
          }
          onBack={() => window.history.back()}
          colorScheme={colorScheme}
        />
      </div>
    </div>
  )
}
