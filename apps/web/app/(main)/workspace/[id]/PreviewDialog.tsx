// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui-react'
import { FileViewerDialog, type FileViewerTarget } from '@/components/media/file-viewer-dialog'
import type { PreviewState } from './types'

interface Props {
  preview: PreviewState | null
  onClose: () => void
}

/**
 * 工作区项目文件预览(2026-11-26 迁移到统一查看器)。
 *
 * 立因:工作区文件此前自带一套预览壳,工具栏、全屏与 AI 解读入口都和文档中心漂移。
 * 现在只保留“加载中”壳,取到字节后交给 FileViewerDialog:
 *  - 原文件下载 / 全屏 / 失败重试全站一致;
 *  - AI 文档助手直接读取 `preview.blob`,不重复请求文件接口;
 *  - 预览仍由 UniversalFilePreview 全格式派发。
 */
export function PreviewDialog({ preview, onClose }: Props) {
  const t = useTranslations('workspace.preview')

  const target = React.useMemo<FileViewerTarget | null>(() => {
    if (!preview?.url || !preview.file.name) return null
    return {
      name: preview.file.name,
      load: preview.blob
        ? async () => preview.blob as Blob
        : async () => {
            const res = await fetch(preview.url as string)
            if (!res.ok) throw new Error(t('cannotPreview'))
            return await res.blob()
          },
    }
  }, [preview, t])

  if (preview?.loading || (preview && !preview.url)) {
    return (
      <Dialog open={!!preview} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="break-words">{preview.file.name}</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
            {preview.loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('loading')}
              </>
            ) : (
              <p className="text-center text-body">{t('cannotPreview')}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return <FileViewerDialog target={target} onClose={onClose} />
}
