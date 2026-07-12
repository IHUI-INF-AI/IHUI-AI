'use client'

import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@ihui/ui'
import { UnifiedAIPanel } from '@/components/ai/unified-ai-panel'
import type { ChatMessage } from './types'

interface Props {
  messages: ChatMessage[]
  onSend: (text: string) => void
  isStreaming: boolean
  streamingContent: string
}

export function UnifiedPanelCard({ messages, onSend, isStreaming, streamingContent }: Props) {
  const t = useTranslations('common.aiWorld')
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {t('unifiedAiPanelTitle')}
        </CardTitle>
        <CardDescription>{t('unifiedAiPanelDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[480px] border-t">
          <UnifiedAIPanel
            messages={messages}
            onSend={onSend}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            placeholder={t('unifiedAiPanelPlaceholder')}
          />
        </div>
      </CardContent>
    </Card>
  )
}
