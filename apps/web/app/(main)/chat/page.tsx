'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { useAiPanelStore } from '@/stores/ai-panel'
import { ErrorBoundary } from '@/components/common'

/**
 * /chat 路由:作为 AI docked 面板的快捷入口。
 * 进入此路由自动打开侧边面板(AISidePanel),不渲染全屏 ChatContent(逻辑已迁移到 AISidePanel)。
 */
function ChatEntry() {
  const t = useTranslations('chat')
  const openPanel = useAiPanelStore((s) => s.openPanel)

  React.useEffect(() => {
    openPanel()
  }, [openPanel])

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-muted-foreground">{t('empty')}</p>
      <p className="text-xs text-muted-foreground/70">{t('emptyHint')}</p>
    </div>
  )
}

export default function ChatPage() {
  return (
    <ErrorBoundary>
      <React.Suspense fallback={null}>
        <ChatEntry />
      </React.Suspense>
    </ErrorBoundary>
  )
}
