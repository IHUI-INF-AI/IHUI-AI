'use client'

import { useTranslations } from 'next-intl'
import { PenTool, ExternalLink } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

export function CanvasPanel() {
  const t = useTranslations('floatingChat.openclaw')

  const handleOpen = () => {
    if (typeof window !== 'undefined') {
      window.alert(t('canvasHint'))
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PenTool className="h-4 w-4" />
            {t('canvasDesc')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('canvasHint')}</p>
          <Button onClick={handleOpen}>
            <ExternalLink className="h-4 w-4" />
            {t('openCanvas')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default CanvasPanel
