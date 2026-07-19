'use client'

import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@ihui/ui'
import { UnifiedAIPanel } from '@/components/ai/unified-ai-panel'
import type { ChatMessage } from './types'

interface Props {
  messages: ChatMessage[]
  onSend: (text: string) => void
  onStop?: () => void
  isStreaming: boolean
  streamingContent: string
  toolbar?: React.ReactNode
}

export function UnifiedPanelCard({
  messages,
  onSend,
  onStop,
  isStreaming,
  streamingContent,
  toolbar,
}: Props) {
  const t = useTranslations('common.aiWorld')
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t('unifiedAiPanelTitle')}
            </CardTitle>
            <CardDescription>{t('unifiedAiPanelDesc')}</CardDescription>
          </div>
          {toolbar && <div className="shrink-0">{toolbar}</div>}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[480px] border-t">
          <UnifiedAIPanel
            messages={messages}
            onSend={onSend}
            onStop={onStop}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            placeholder={t('unifiedAiPanelPlaceholder')}
          />
        </div>
      </CardContent>
    </Card>
  )
}
