'use client'

import { useTranslations } from 'next-intl'

import { Card, CardContent } from '@ihui/ui-react'
import { ImageViewer, VideoPlayer } from '@/components/media'

interface Props {
  lastImage: string | null
  lastVideo: string | null
  onClear: () => void
}

export function AiGenerationPreview({ lastImage, lastVideo, onClear }: Props) {
  const t = useTranslations('aiGeneration')

  if (!lastImage && !lastVideo) return null

  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{t('preview')}</p>
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('clear')}
          </button>
        </div>
        {lastImage && (
          <ImageViewer src={lastImage} alt="generated" className="max-h-[480px] border" />
        )}
        {lastVideo && <VideoPlayer src={lastVideo} className="aspect-video" />}
      </CardContent>
    </Card>
  )
}
