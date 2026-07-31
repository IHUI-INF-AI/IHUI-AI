'use client'

import { useTranslations } from 'next-intl'
import { Mic, Play } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { useConfirm } from '@/hooks/use-confirm'

export function VoicePanel() {
  const t = useTranslations('floatingChat.openclaw')
  const { confirm, ConfirmDialogRenderer } = useConfirm()

  const handleStart = async () => {
    await confirm({ title: t('voiceHint'), hideCancel: true })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="h-4 w-4" />
            {t('voiceDesc')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('voiceHint')}</p>
          <Button onClick={() => void handleStart()}>
            <Play className="h-4 w-4" />
            {t('startVoice')}
          </Button>
        </CardContent>
      </Card>
      <ConfirmDialogRenderer />
    </div>
  )
}

export default VoicePanel
