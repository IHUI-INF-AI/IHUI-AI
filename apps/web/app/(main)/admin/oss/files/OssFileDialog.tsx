'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui-react'
import { FilePreview } from '@/components/media'
import type { OssFile } from './types'

interface Props {
  file: OssFile | null
  onClose: () => void
}

export function OssFileDialog({ file, onClose }: Props) {
  return (
    <Dialog
      open={!!file}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="break-words">{file?.fileName ?? '预览'}</DialogTitle>
        </DialogHeader>
        <div className="min-h-[300px]">
          {file?.url ? (
            <FilePreview url={file.url} name={file.fileName} className="max-h-[60vh]" />
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">文件无可用预览地址</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
