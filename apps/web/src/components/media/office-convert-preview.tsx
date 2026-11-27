// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, Loader2 } from 'lucide-react'
import { PDFViewer } from './PDFViewer'
import { fetchRaw } from '@/lib/api'
import { cn } from '@/lib/utils'

/** 服务端 LibreOffice 转换上限;客户端先拦一次,避免把 100MB 传上去再被 413。 */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export interface OfficeConvertPreviewProps {
  readonly src: string
  readonly name: string
  readonly ext: string
  readonly className?: string
}

async function readSource(src: string, signal: AbortSignal): Promise<Blob> {
  try {
    const response = await fetch(src, { signal })
    if (response.ok) return await response.blob()
  } catch (error) {
    if (signal.aborted) throw error
  }
  // blob: 之外的签名 URL / 需要鉴权的同源地址走统一 fetchRaw(带 token/设备头)。
  return fetchRaw(src, { signal })
}

/**
 * 旧版 Office(doc/ppt/odt/rtf 等)的转换预览。
 *
 * 前端不解析 OLE 复合文档,把已取到的字节交给 `POST /api/office/preview`,
 * 服务端用 LibreOffice 转 PDF,再用与 PDF 文件完全相同的 pdf.js 查看器渲染。
 * 这样 `.doc` / `.ppt` 也复用文档中心的翻页、缩放、文本选择,而不是退化成下载卡。
 */
export function OfficeConvertPreview({ src, name, ext, className }: OfficeConvertPreviewProps) {
  const t = useTranslations('chat')
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const uploadName = React.useMemo(() => {
    const normalized = ext.replace(/^\./, '').toLowerCase()
    return name.toLowerCase().endsWith(`.${normalized}`) ? name : `${name}.${normalized}`
  }, [ext, name])

  React.useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | null = null
    setPdfUrl(null)
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const source = await readSource(src, controller.signal)
        if (source.size > MAX_UPLOAD_BYTES) {
          throw new Error('文件超过 50MB,无法在线转换')
        }
        const form = new FormData()
        form.append('file', source, uploadName)
        const pdf = await fetchRaw('/api/office/preview', {
          method: 'POST',
          body: form,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(pdf)
        setPdfUrl(objectUrl)
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : '文档转换失败')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src, uploadName])

  if (loading) {
    return (
      <div
        className={cn(
          'flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-md border bg-muted/30 p-6 text-center',
          className,
        )}
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
        <p className="text-body text-muted-foreground">{t('officeLoading')}</p>
        <p className="text-label text-muted-foreground">{ext.toUpperCase()} → PDF · LibreOffice</p>
      </div>
    )
  }

  if (error || !pdfUrl) {
    return (
      <div
        role="alert"
        className={cn(
          'flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/30 p-6 text-center',
          className,
        )}
      >
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
        <p className="text-body font-medium">{t('officeFailed')}</p>
        <p className="max-w-md text-label text-muted-foreground">{error ?? '文档转换失败'}</p>
        <a
          className="text-label text-primary underline underline-offset-4"
          href={src}
          download={uploadName}
        >
          {t('officeDownload')}
        </a>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2 text-label text-muted-foreground">
        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
          {ext.toUpperCase()}
        </span>
        <span>→ PDF · LibreOffice</span>
        <span className="ml-auto">{t('officePreviewLabel')}</span>
      </div>
      <div className="h-[520px] overflow-hidden rounded-md border bg-background">
        <PDFViewer url={pdfUrl} className="h-full" />
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
