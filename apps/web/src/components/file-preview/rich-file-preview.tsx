// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { OfficePreview, SUPPORTED_EXTS } from '@/components/media/office-preview'
import { richPreviewKindOf } from '@/lib/file-preview-attachment'
import { DelimitedFilePreview } from './delimited-file-preview'
import { PdfFilePreview } from './pdf-file-preview'
import { PreviewErrorCard } from './preview-error-card'

/**
 * 会话内富预览派发器(V3 #70)—— 唯一的"按扩展名选渲染器"入口。
 *
 * 三型各自复用仓内既有素材,不新起第二套:
 *  - pdf → `PdfFilePreview`(内含既有 `PDFViewer`,pdf.js 真渲染 + 页码/翻页/缩放)
 *  - csv / tsv → `DelimitedFilePreview`(表头固定 / 列宽自适应 / 行数上限如实提示)
 *  - office 那一族 → 转交既有 `OfficePreview`;**支持与否由它的 `SUPPORTED_EXTS` 判**,
 *    本文件不复制第二张支持表(转交后它自己会落"不支持"态)
 *  - 其余 → 错误卡(该文件类型不支持预览 + 下载出口)
 */

export interface RichFilePreviewProps {
  /** 附件 href(同源或 https;CSP 现值两面都已放行,见 next.config.ts 与本票交付报告) */
  readonly href: string
  /** 归一化后的扩展名(由调用方给出,派发器不再自己解析一遍第二个真相) */
  readonly ext: string
  readonly className?: string
}

export function RichFilePreview({ href, ext, className }: RichFilePreviewProps) {
  const kind = richPreviewKindOf(ext)

  switch (kind.kind) {
    case 'pdf':
      return <PdfFilePreview src={href} className={className} />
    case 'delimited':
      return (
        <DelimitedFilePreview
          src={href}
          format={kind.format}
          delimiter={kind.delimiter}
          className={className}
        />
      )
    case 'office':
      // SUPPORTED_EXTS 是"支持清单"的唯一真相:不在表里的一律不转交,直接落错误卡。
      if (SUPPORTED_EXTS.has(ext)) {
        return <OfficePreview src={href} ext={ext} />
      }
      return <PreviewErrorCard failure="unsupported" ext={ext} href={href} className={className} />
    case 'unsupported':
      return <PreviewErrorCard failure="unsupported" ext={ext} href={href} className={className} />
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
