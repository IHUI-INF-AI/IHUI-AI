'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui'
import { FilePreview } from '@/components/media'
import type { PreviewState } from './types'

interface Props {
  preview: PreviewState | null
  onClose: () => void
}

export function PreviewDialog({ preview, onClose }: Props) {
  const t = useTranslations('workspace.preview')
  return (
    <Dialog
      open={!!preview}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="break-words">{preview?.file.name ?? t('title')}</DialogTitle>
        </DialogHeader>
        <div className="min-h-[300px]">
          {preview?.loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : preview?.url ? (
            <FilePreview url={preview.url} name={preview.file.name} className="max-h-[60vh]" />
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">{t('cannotPreview')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
