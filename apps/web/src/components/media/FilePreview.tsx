// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Copy, Download, ZoomIn, ZoomOut } from 'lucide-react'
import {
  imageCounterView,
  imageTransferView,
  pageImage,
  zoomStep,
  type ImageTransferKind,
  type ImageTransferResult,
} from '@ihui/shared/chat/element-pack'
import { cn } from '@/lib/utils'
import { OfficeViewer } from './OfficeViewer'
import { ThreeDViewer } from './ThreeDViewer'
import { PDFViewer } from './PDFViewer'
import {
  PreviewFileUpdatedBar,
  PreviewNoContentState,
  PreviewSnapshotNotice,
  usePreviewCopy,
} from './preview-degradation-banner'
import { usePreviewMediaProbe, usePreviewTextFeed } from './use-preview-staleness'

/** D64 ②:同组多图的一项(多图数据由调用方注入,本组件不自行收集消息附件)。 */
export interface ImagePreviewItem {
  url: string
  name?: string
}

interface FilePreviewProps {
  url: string
  type?: 'pdf' | 'office' | 'image' | 'text' | '3d' | 'auto'
  name?: string
  className?: string
  /**
   * D64 ②(2026-09-24 立):同组图片列表。长度 > 1 时图片预览出现**翻页**(上一张/下一张)
   * 与**「第 N · M 张」计数**;判据一律走 `element-pack` 的 pageImage / imageCounterView。
   * 不传或单图 ⇒ 与改造前逐字一致(不出现空壳控件)。
   */
  gallery?: readonly ImagePreviewItem[]
  /** 受控起始下标(0 基,越界由判定层钳制);不传则内部 state */
  galleryIndex?: number
  /** 下标变化回调(宿主需要把翻页同步回消息流时传) */
  onGalleryIndexChange?: (index: number) => void
}

export function FilePreview({
  url,
  type = 'auto',
  name,
  className,
  gallery,
  galleryIndex,
  onGalleryIndexChange,
}: FilePreviewProps) {
  const detectedType = React.useMemo(() => {
    if (type !== 'auto') return type
    const ext = url.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return 'pdf'
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext ?? '')) return 'office'
    if (['glb', 'gltf', 'obj', 'stl'].includes(ext ?? '')) return '3d'
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext ?? '')) return 'image'
    if (['txt', 'md', 'json', 'csv', 'log'].includes(ext ?? '')) return 'text'
    return 'text'
  }, [url, type])

  if (detectedType === 'image') {
    return (
      <ImagePreview
        url={url}
        name={name}
        className={className}
        gallery={gallery}
        galleryIndex={galleryIndex}
        onGalleryIndexChange={onGalleryIndexChange}
      />
    )
  }

  if (detectedType === 'pdf') {
    return <PDFViewer url={url} className={className} />
  }

  if (detectedType === 'office') {
    return <OfficeViewer url={url} fileName={name} className={className} />
  }

  if (detectedType === '3d') {
    const ext = url.split('.').pop()?.toLowerCase()
    const format = (ext && ['glb', 'gltf', 'obj', 'stl'].includes(ext) ? ext : 'glb') as
      'glb' | 'gltf' | 'obj' | 'stl'
    return <ThreeDViewer url={url} format={format} className={className} />
  }

  return <TextPreview url={url} className={className} />
}

function TextPreview({ url, className }: { url: string; className?: string }) {
  const t = useTranslations('a11y')
  const copy = usePreviewCopy(t)
  const feed = usePreviewTextFeed(url)

  if (feed.loading) return <div className="p-3 text-sm text-muted-foreground">{t('loading')}</div>

  // 什么都没读到、也没有任何历史记录可展示:明说"没有可预览内容"并给出刷新这一步
  if (feed.notice === 'no-content')
    return (
      <PreviewNoContentState
        copy={copy}
        refreshLabel={t('refresh')}
        onRefresh={feed.refresh}
        className={className}
      />
    )

  return (
    <div
      data-preview-state={feed.isRecord ? 'record' : 'current'}
      className={cn('flex min-h-0 flex-col overflow-hidden rounded-md bg-muted', className)}
    >
      {feed.fileUpdated && (
        <PreviewFileUpdatedBar
          copy={copy}
          closeLabel={t('closeAlert')}
          onApply={feed.applyLatest}
          onDismiss={feed.dismissFileUpdated}
        />
      )}
      <PreviewSnapshotNotice
        isRecord={feed.isRecord}
        notice={feed.notice}
        readAt={feed.readAt}
        copy={copy}
      />
      <pre className="min-h-0 flex-1 overflow-auto p-3 text-sm">
        <code>{feed.content}</code>
      </pre>
    </div>
  )
}

/**
 * 图片预览也走同一套内容身份判定(D90 降级依据"资源还能不能取到",与是否文本无关):
 * 取不到但手里有此前取到的内容 → 明说这是工具记录里的历史图片;两头都空 → L4。
 * 渲染源仍用调用方给的 url(可能是带有效期的签名地址),不改成 blob:那会牵动 CSP,
 * 且图片读不到时 L2 文案已把"看到的不是当前文件"说清楚。
 *
 * D64 ②(2026-09-24 装车):补**翻页 / 第 N·M 张 / 缩放档位 / 保存与复制成败**。
 * 四条判据全部来自 `@ihui/shared/chat/element-pack`(pageImage / imageCounterView /
 * zoomStep / imageTransferView),本文件只做渲染与样式映射,不另写第二套判定。
 */
function ImagePreview({
  url,
  name,
  className,
  gallery,
  galleryIndex,
  onGalleryIndexChange,
}: {
  url: string
  name?: string
  className?: string
  gallery?: readonly ImagePreviewItem[]
  galleryIndex?: number
  onGalleryIndexChange?: (index: number) => void
}) {
  const t = useTranslations('a11y')
  // 判定层给的是 `ai.pane.elementPack` 内的相对键(imagePreview.*),此处按该命名空间取词
  const te = useTranslations('ai.pane.elementPack')
  const copy = usePreviewCopy(t)
  const items = React.useMemo<readonly ImagePreviewItem[]>(
    () => (gallery && gallery.length > 0 ? gallery : [{ url, name }]),
    [gallery, url, name],
  )
  const total = items.length
  const isControlled = typeof galleryIndex === 'number'
  const [internalIndex, setInternalIndex] = React.useState<number>(galleryIndex ?? 0)
  const requested = isControlled ? (galleryIndex as number) : internalIndex
  const active = pageImage(requested, total) ?? 0
  const current = items[active]
  const counter = imageCounterView(active, total)
  const feed = usePreviewMediaProbe(current.url)

  const go = React.useCallback(
    (delta: number) => {
      const next = pageImage(active + delta, total, { wrap: true })
      if (next === null) return
      if (!isControlled) setInternalIndex(next)
      onGalleryIndexChange?.(next)
    },
    [active, total, isControlled, onGalleryIndexChange],
  )

  const [zoom, setZoom] = React.useState<number>(1)
  const zoomBy = (direction: 'in' | 'out') => setZoom((prev) => zoomStep(prev, direction))
  const zoomPercent = `${Math.round(zoom * 100)}%`

  const [transfer, setTransfer] = React.useState<{
    kind: ImageTransferKind
    result: ImageTransferResult
  } | null>(null)
  const transferLabel = transfer ? te(imageTransferView(transfer.kind, transfer.result)) : null

  const handleSave = React.useCallback(() => {
    try {
      const a = document.createElement('a')
      a.href = current.url
      a.download = current.name ?? `image-${active + 1}`
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTransfer({ kind: 'save', result: 'success' })
    } catch {
      // 下载被宿主拦下(无手势 / 策略拒绝)时**明说失败**,不静默吞
      setTransfer({ kind: 'save', result: 'failed' })
    }
  }, [current.url, current.name, active])

  const handleCopy = React.useCallback(async () => {
    try {
      const res = await fetch(current.url)
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function') {
        throw new Error('clipboard-unavailable')
      }
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      setTransfer({ kind: 'copy', result: 'success' })
    } catch {
      setTransfer({ kind: 'copy', result: 'failed' })
    }
  }, [current.url])

  if (feed.notice === 'no-content')
    return (
      <PreviewNoContentState
        copy={copy}
        refreshLabel={t('refresh')}
        onRefresh={feed.refresh}
        className={className}
      />
    )

  const toolBtn =
    'inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none'

  return (
    <div
      data-preview-state={feed.isRecord ? 'record' : 'current'}
      className={cn('flex min-h-0 flex-col', className)}
      data-image-preview-total={total}
      data-image-preview-index={active}
    >
      <PreviewSnapshotNotice
        isRecord={feed.isRecord}
        notice={feed.notice}
        readAt={feed.readAt}
        copy={copy}
      />
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <Image
          src={current.url}
          alt={current.name ?? 'preview'}
          width={800}
          height={600}
          unoptimized
          className="h-auto w-auto min-h-0 max-h-full max-w-full flex-1 object-contain"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
          data-testid="image-preview-img"
          data-image-zoom={zoomPercent}
        />
      </div>

      {/* 控件条:多图才给翻页;缩放与保存/复制恒给(单图同样需要)。全部走判定层键。 */}
      <div
        className="flex flex-wrap items-center gap-1 px-1 py-1 text-[11px] text-muted-foreground"
        data-image-toolbar="true"
      >
        {total > 1 ? (
          <>
            <button
              type="button"
              className={toolBtn}
              onClick={() => go(-1)}
              aria-label={te('imagePreview.prev')}
              data-image-nav="prev"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className={toolBtn}
              onClick={() => go(1)}
              aria-label={te('imagePreview.next')}
              data-image-nav="next"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </>
        ) : null}
        {counter ? (
          <span className="tabular-nums" data-image-counter="true">
            {te(counter.labelKey, counter.values)}
          </span>
        ) : null}
        <button
          type="button"
          className={toolBtn}
          onClick={() => zoomBy('out')}
          aria-label={te('imagePreview.zoomOut')}
          data-image-zoom-btn="out"
        >
          <ZoomOut className="h-3.5 w-3.5" aria-hidden />
        </button>
        <span className="tabular-nums" data-image-zoom-label="true">
          {zoomPercent}
        </span>
        <button
          type="button"
          className={toolBtn}
          onClick={() => zoomBy('in')}
          aria-label={te('imagePreview.zoomIn')}
          data-image-zoom-btn="in"
        >
          <ZoomIn className="h-3.5 w-3.5" aria-hidden />
        </button>
        <div className="ml-auto flex items-center gap-1">
          <span
            aria-live="polite"
            data-image-transfer={transfer ? `${transfer.kind}-${transfer.result}` : 'idle'}
            className={cn(
              'truncate',
              transfer?.result === 'failed'
                ? 'text-red-600 dark:text-red-500'
                : 'text-emerald-600 dark:text-emerald-500',
            )}
          >
            {transferLabel ?? ''}
          </span>
          <button
            type="button"
            className={toolBtn}
            onClick={handleSave}
            aria-label={te('imagePreview.save')}
            data-image-transfer-btn="save"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            className={toolBtn}
            onClick={() => void handleCopy()}
            aria-label={te('imagePreview.copy')}
            data-image-transfer-btn="copy"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
