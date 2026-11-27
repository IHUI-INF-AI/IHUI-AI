// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { FilePreview } from './FilePreview'
import { SUPPORTED_EXTS } from './office-preview'
import { OfficeConvertPreview } from './office-convert-preview'
import { DelimitedFilePreview } from '@/components/file-preview/delimited-file-preview'
import { PreviewErrorCard, fileNameOf } from '@/components/file-preview/preview-error-card'
import { previewExtOf, previewKindOf } from '@/lib/file-preview-kind'
import { toMediaStreamUrl } from '@/lib/media-proxy'
import { cn } from '@/lib/utils'

/**
 * 全格式文件预览派发器(2026-11-26 立,文档中心 ↔ AI 面板 ↔ 工作区共用)。
 *
 * 判型表只有一张(`@/lib/file-preview-kind`),这里只做"档 → 渲染器"的分流:
 *  - image / video → `FilePreview` 的图片视口(视频复用其持久 <video> 与同源代理)
 *  - audio         → 本地 <audio>(CSP media-src 只认同源,外部源走 /api/media/stream)
 *  - pdf           → `FilePreview` 的 PDFViewer(pdf.js 真渲染)
 *  - office        → docx/xlsx/xls/pptx 交 `OfficePreview` 本地真渲染;
 *                    doc/ppt/odt/odp/ods/rtf 交 `OfficeConvertPreview` 走服务端
 *                    LibreOffice → PDF(不再退化成"不支持 + 下载")
 *  - csv / tsv     → 分隔符表格(与附件富预览同一实现)
 *  - 3d            → `FilePreview` 的 ThreeDViewer
 *  - text          → `FilePreview` 的文本预览(含代码/JSON/网页源码,html 不执行)
 *  - download      → 能力边界卡(保留下载出口,zip 与未知档落此)
 */

export interface UniversalFilePreviewProps {
  /** 已在手的地址(blob: / 同源 / 签名 URL 均可) */
  readonly src: string
  /** 展示用文件名;缺省从地址推导 */
  readonly name?: string
  /** 归一化扩展名;缺省从展示文件名/地址推导(blob 地址无后缀时靠 name) */
  readonly ext?: string
  readonly className?: string
}

/** 浏览器不解析、改由服务端 LibreOffice 转 PDF 的旧版文档格式。 */
const CONVERTIBLE_OFFICE_EXTS = new Set(['doc', 'ppt', 'odt', 'odp', 'ods', 'rtf'])

export function UniversalFilePreview({ src, name, ext, className }: UniversalFilePreviewProps) {
  // FileViewerDialog / 文档集市把带鉴权的原始地址先取成 blob:,地址本身没有后缀;
  // 此时必须以调用方给的展示文件名作为第二判据,否则所有 blob 预览都会误判 download。
  const explicitExt = ext?.replace(/^\./, '').toLowerCase() ?? ''
  const extFromName = name ? previewExtOf(name) : ''
  const resolvedExt = explicitExt || extFromName || previewExtOf(src)
  const kind = previewKindOf(resolvedExt)
  const displayName = name ?? fileNameOf(src)

  switch (kind) {
    case 'image':
    case 'video':
      return <FilePreview url={src} type="image" name={displayName} className={className} />
    case 'audio':
      return <AudioPreview src={src} name={displayName} className={className} />
    case 'pdf':
      return <FilePreview url={src} type="pdf" name={displayName} className={className} />
    case 'office':
      // 支持清单的唯一真相源仍是 OfficePreview 的 SUPPORTED_EXTS;docx/xlsx/xls/pptx
      // 在浏览器内真渲染,旧版 doc/ppt/odt/rtf 走服务端 LibreOffice → PDF。
      if (!SUPPORTED_EXTS.has(resolvedExt)) {
        if (CONVERTIBLE_OFFICE_EXTS.has(resolvedExt)) {
          return (
            <OfficeConvertPreview
              src={src}
              name={displayName}
              ext={resolvedExt}
              className={className}
            />
          )
        }
        return (
          <PreviewErrorCard
            failure="unsupported"
            ext={resolvedExt}
            href={src}
            className={className}
          />
        )
      }
      return (
        <FilePreview
          url={src}
          type="office"
          name={displayName}
          ext={resolvedExt}
          className={className}
        />
      )
    case 'delimited':
      return (
        <DelimitedFilePreview
          src={src}
          format={resolvedExt === 'tsv' ? 'tsv' : 'csv'}
          delimiter={resolvedExt === 'tsv' ? '\t' : ','}
          className={className}
        />
      )
    case 'three':
      return <FilePreview url={src} type="3d" name={displayName} className={className} />
    case 'text':
      return <FilePreview url={src} type="text" name={displayName} className={className} />
    case 'download':
      return (
        <PreviewErrorCard
          failure="unsupported"
          ext={resolvedExt}
          href={src}
          className={className}
        />
      )
  }
}

/** 音频预览:同源代理 + 浏览器原生控件(不新起播放器,避免与 VideoPlayer 两套状态机)。 */
function AudioPreview({ src, name, className }: { src: string; name: string; className?: string }) {
  const t = useTranslations('a11y')
  return (
    <div className={cn('flex flex-col gap-2 rounded-md bg-muted p-3', className)}>
      <p className="truncate text-body">{name}</p>
      {/* 纯音频无字幕轨可挂(jsx-a11y 规则按 <audio> 一刀切);浏览器原生控件承担播放状态。 */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio controls preload="metadata" src={toMediaStreamUrl(src)} className="w-full">
        {t('videoLoadFailed')}
      </audio>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
