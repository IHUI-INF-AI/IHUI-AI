'use client'

import { useState } from 'react'
import { FeedbackScreen, type FeedbackSubmitPayload } from '@ihui/rn-app'
import { useTranslations } from 'next-intl'

/**
 * /shared-demo/feedback — web 端共享 FeedbackScreen 验证页。
 *
 * 用 mock onSubmit 验证共享组件在 web 端的渲染效果(react-native-web alias)。
 * 不替换 web 生产页(/feedback),生产页有更复杂的列表+表单双 tab 实现。
 */
export default function SharedDemoFeedbackPage() {
  const t = useTranslations()
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light')

  // mock onSubmit — 模拟 API 延迟,返回成功
  const handleSubmit = async (payload: FeedbackSubmitPayload): Promise<boolean> => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    console.info('[shared-demo/feedback] mock submit:', payload)
    return true
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">共享 FeedbackScreen 验证</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          此页验证 @ihui/rn-app 的 FeedbackScreen 在 web 端的渲染(react-native-web alias)。
          生产页 /feedback 有更复杂的列表+表单双 tab 实现。
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
        <FeedbackScreen
          t={(key: string) => t(key)}
          onSubmit={handleSubmit}
          onBack={() => window.history.back()}
          colorScheme={colorScheme}
        />
      </div>
    </div>
  )
}
