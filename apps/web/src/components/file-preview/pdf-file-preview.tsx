// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { PDFViewer } from '@/components/media/PDFViewer'
import {
  PreviewViewSwitch,
  type PreviewSourceAvailability,
} from '@/components/media/preview-view-switch'
import { fileNameOf } from './preview-error-card'

/**
 * 会话内 PDF 富预览(V3 #70 判据 1)。
 *
 * **复用不自造**:渲染层是仓内既有的 `PDFViewer`(pdf.js canvas 逐页渲染,自带
 * 页码/翻页/缩放/文字层),worker 由它自己指向同源 `/pdfjs/pdf.worker.min.mjs` ——
 * 那份是守门 107 登记的第三方 vendored 件,本组件**不读不写不改**,只在外面套
 * "源码档不可用说明 + 新窗口打开"这一条 chrome。
 *
 * 为什么不沿用浏览器原生 iframe 查看器:iframe 的缩放与翻页在宿主里不可寻址
 * (拿不到"当前页/总页数"的真值,只能靠 `#page=` 锚猜),而票面要求页码/翻页/缩放
 * 为可验行为。pdf.js 侧 `PDFViewer` 把三件都摆在组件状态里,测试能直接断言。
 *
 * 关于 `PreviewViewSwitch`:源码档 disabled 且带原因 —— 正常路径点不到它,这里存在的意义
 * 是把"绕过 disabled 的调用"钉成无事发生,避免出现一个没有内容的 source 视图。
 */

/**
 * PDF 的源码档**恒定不可用**,并写明原因(沿用 message-file-preview 的同一判据,
 * 不另立一套可用性语义):渲染层手里只有 canvas 位图,从来没有正文字节。
 */
const PDF_SOURCE_AVAILABILITY: PreviewSourceAvailability = {
  available: false,
  reason: 'previewSourceUnavailableBinary',
}

export interface PdfFilePreviewProps {
  readonly src: string
  readonly className?: string
}

export function PdfFilePreview({ src, className }: PdfFilePreviewProps) {
  const t = useTranslations('chat')

  return (
    <div
      className={cn(
        'my-0 flex h-[420px] flex-col overflow-hidden rounded-md border border-border',
        className,
      )}
      data-testid="pdf-file-preview"
      data-artifact-preview-kind="pdf"
      data-preview-view="preview"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 bg-muted/40 px-2 py-1">
        <span className="truncate text-[10px] font-medium text-muted-foreground">
          {fileNameOf(src)}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <PreviewViewSwitch
            mode="preview"
            onModeChange={() => undefined}
            source={PDF_SOURCE_AVAILABILITY}
          />
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            data-testid="pdf-open-external"
          >
            <ExternalLink className="h-3 w-3" />
            <span>{t('pdfOpenExternal')}</span>
          </a>
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <PDFViewer url={src} className="h-full" />
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
