// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  imageCounterView,
  imageTransferView,
  pageImage,
  zoomStep,
  type ImageTransferKind,
  type ImageTransferResult,
} from '@ihui/shared/chat/element-pack'
// G-853 平移判据的唯一出口(与 mobile-rn 端共用同一份算式)。走**子路径**导入:
// `src/utils/index.ts` 那份 barrel 此刻被并行会话持有,按 §12 不得提交别人的在飞文件。
import {
  clampImagePreviewOffset,
  imagePreviewPanApplies,
} from '@ihui/shared/utils/image-preview-offset'
import { cn } from '@/lib/utils'
import { fetchGatedBlob } from '@/lib/gated-blob-fetch'
import { downloadFilenameFor } from '@/lib/file-preview-attachment'
import { OfficeViewer } from './OfficeViewer'
import { ThreeDViewer } from './ThreeDViewer'
import { PDFViewer } from './PDFViewer'
import {
  PreviewExpiredState,
  PreviewFileUpdatedBar,
  PreviewNoContentState,
  PreviewSnapshotNotice,
  PreviewTooLargeState,
  usePreviewCopy,
} from './preview-degradation-banner'
import { usePreviewMediaProbe, usePreviewTextFeed } from './use-preview-staleness'

/** D64 ②:同组多图的一项(多图数据由调用方注入,本组件不自行收集消息附件)。 */
export interface ImagePreviewItem {
  url: string
  name?: string
}

// G-856,2026-10-07:画廊内逐项判定 video。媒体画廊是图片/视频混合的,判定只能按 item
// 做,不能按整组做 —— 对位上游 image-preview-dialog 的 activeItemIsVideo。
const GALLERY_VIDEO_EXTENSIONS: readonly string[] = ['mp4', 'webm', 'ogv', 'ogg', 'mov', 'm4v']

function isVideoSource(url: string): boolean {
  const path = url.split(/[?#]/)[0] ?? ''
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return ext !== '' && GALLERY_VIDEO_EXTENSIONS.includes(ext)
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
  // D163:打开原文是 expired / too-large 两态共用的出口(新标签页,不带 opener)
  const openSource = React.useCallback(() => {
    window.open(url, '_blank', 'noopener')
  }, [url])

  if (feed.loading) return <div className="p-3 text-sm text-muted-foreground">{t('loading')}</div>

  // D163 五态·expired:地址/记录已失效 —— 给"重试 + 打开原文"
  if (feed.notice === 'expired')
    return (
      <PreviewExpiredState
        copy={copy}
        onRetry={feed.refresh}
        onOpenSource={openSource}
        className={className}
      />
    )

  // D163 五态·tooLarge:内容超 PREVIEW_MAX_BYTES —— 重试无意义,给"打开原文"
  if (feed.notice === 'too-large')
    return <PreviewTooLargeState copy={copy} onOpenSource={openSource} className={className} />

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
        onRetry={feed.refresh}
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
  // items 按构造恒非空(无 gallery 时回落成单图),但索引取值带 `| undefined`;
  // 用同一个回落式兜住而不是断言 —— 兜底值与构造路径逐字相同,不会引入第二套语义
  const current = items[active] ?? { url, name }
  const counter = imageCounterView(active, total)
  const feed = usePreviewMediaProbe(current.url)
  // D163:打开原文是 expired / too-large 两态共用的出口(新标签页,不带 opener)
  const openSource = React.useCallback(() => {
    window.open(current.url, '_blank', 'noopener')
  }, [current.url])

  const go = React.useCallback(
    (delta: number) => {
      const next = pageImage(active + delta, total, { wrap: true })
      if (next === null) return
      if (!isControlled) setInternalIndex(next)
      onGalleryIndexChange?.(next)
    },
    [active, total, isControlled, onGalleryIndexChange],
  )

  // ---- G-856:video 分支(单个持久 <video> 元素 + 切项复位/暂停) --------------------------
  // 对位上游 image-preview-dialog:切到别的 item 就 pause()(:222-228);loading/unsupported
  // 三态里解码失败只收口当前 item(:477-478),不能关闭预览或影响相邻媒体。
  const currentIsVideo = isVideoSource(current.url)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const [videoState, setVideoState] = React.useState<'loading' | 'ready' | 'unsupported'>('loading')

  React.useEffect(() => {
    // 切项即复位三态:上一项的解码失败不连坐下一项(每项独立收口)。
    setVideoState('loading')
  }, [active, current.url])

  React.useEffect(() => {
    // 先把当前元素抓进闭包,cleanup 里再暂停:即使切到图片项导致 <video> 卸载、
    // ref 已被 React 置空,闭包里的引用仍然有效(分离的媒体元素在浏览器里会继续发声)。
    const el = videoRef.current
    return () => {
      el?.pause()
    }
  }, [active, current.url])

  const [zoom, setZoom] = React.useState<number>(1)
  const zoomBy = (direction: 'in' | 'out') => setZoom((prev) => zoomStep(prev, direction))
  const zoomPercent = `${Math.round(zoom * 100)}%`

  // ---- G-853:放大后的平移 + pointer capture 的显式释放 -------------------------------
  // 判据(能不能平移 / 平移量的边界)一律走 `@ihui/shared/utils/image-preview-offset`,
  // 与 mobile-rn 端同一份算式;本文件只做 DOM 侧的取材与手势接线,不在此推第二套钳制。
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const [offset, setOffset] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 })
  /** 只跟一根指针:记录按下时的坐标与当时的平移量(多指不叠加,免得抖动) */
  const dragRef = React.useRef<{
    id: number
    x0: number
    y0: number
    ox: number
    oy: number
  } | null>(null)
  /** 本组件实际捕获过的 pointerId —— 释放出口按它判,不靠"猜有没有捕获" */
  const capturedRef = React.useRef<number | null>(null)
  const [panReady, setPanReady] = React.useState<boolean>(false)

  /**
   * 取材:图片的 `getBoundingClientRect()` 含 transform scale 后的**实际渲染尺寸**,
   * 外层视口那层给未缩放的窗口尺寸 —— 两者直接喂共享判据,端内不再乘一次 zoom。
   * 量不到(未挂载 / 图片还没出盒)一律回 null,由调用方落到"不平移",不猜一个数。
   */
  const measurePanGeometry = React.useCallback(() => {
    const viewport = viewportRef.current
    const img = viewport?.querySelector('img') ?? null
    if (!viewport || !img) return null
    const box = viewport.getBoundingClientRect()
    const imageBox = img.getBoundingClientRect()
    return {
      viewportWidth: box.width,
      viewportHeight: box.height,
      scaledWidth: imageBox.width,
      scaledHeight: imageBox.height,
    }
  }, [])

  const releasePointerCapture = React.useCallback((pointerId: number) => {
    const target = viewportRef.current
    capturedRef.current = null
    if (!target || typeof target.releasePointerCapture !== 'function') return
    // hasPointerCapture 存在时先问一次:对不活跃的 pointerId 调 release 会抛 DOMException,
    // 而这一步只是收尾,绝不能因为收尾失败把手势卡在"还在拖"。
    if (typeof target.hasPointerCapture === 'function' && !target.hasPointerCapture(pointerId))
      return
    try {
      target.releasePointerCapture(pointerId)
    } catch {
      /* 收尾失败不阻断:平移量已复位,捕获残留由下一次按下覆盖 */
    }
  }, [])

  React.useEffect(() => {
    // 换图 / 翻页 / 改缩放 ⇒ 平移复位(否则放大倍数变小后图片会停在视口外)。
    setOffset({ x: 0, y: 0 })
    dragRef.current = null
    const box = viewportRef.current
    if (box) {
      const geometry = measurePanGeometry()
      setPanReady(
        geometry === null ? false : imagePreviewPanApplies({ offsetX: 0, offsetY: 0, ...geometry }),
      )
    }
    // 卸载出口:票面引的上游注释直说"残留 capture 会让 hover/click 继续命中视口而不是浮层按钮",
    // 所以 pointerup / pointercancel / **卸载** 三个出口都要显式释放,少一个就是留一根幽灵捕获。
    return () => {
      const captured = capturedRef.current
      if (captured !== null && box && typeof box.releasePointerCapture === 'function') {
        try {
          box.releasePointerCapture(captured)
        } catch {
          /* 卸载路径上的收尾失败无从补救,静默但不抛 */
        }
      }
      capturedRef.current = null
      dragRef.current = null
    }
  }, [zoom, active, current.url, measurePanGeometry])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const geometry = measurePanGeometry()
    // 未放大 ⇒ 整段不吃事件:既不捕获指针,也不 touch-action: none,页面滚动照常(验收项 2)。
    if (!geometry || !imagePreviewPanApplies({ offsetX: 0, offsetY: 0, ...geometry })) return
    dragRef.current = {
      id: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      ox: offset.x,
      oy: offset.y,
    }
    const target = event.currentTarget
    if (typeof target.setPointerCapture === 'function') {
      try {
        target.setPointerCapture(event.pointerId)
        capturedRef.current = event.pointerId
      } catch {
        capturedRef.current = null
      }
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return
    const geometry = measurePanGeometry()
    if (!geometry) return
    setOffset(
      clampImagePreviewOffset({
        offsetX: drag.ox + (event.clientX - drag.x0),
        offsetY: drag.oy + (event.clientY - drag.y0),
        ...geometry,
      }),
    )
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return
    dragRef.current = null
    releasePointerCapture(event.pointerId)
  }

  const [transfer, setTransfer] = React.useState<{
    kind: ImageTransferKind
    result: ImageTransferResult
  } | null>(null)
  const transferLabel = transfer ? te(imageTransferView(transfer.kind, transfer.result)) : null

  const handleSave = React.useCallback(async () => {
    try {
      // 浏览器对跨域 URL 会忽略 download 属性(变成一次导航),所以先把字节取到手再落盘;
      // 取不到(被 CORS 拒 / 网络错 / 超上限)一律报失败,不播报"已保存"(G-851)。
      const blob = await fetchGatedBlob(current.url)
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = downloadFilenameFor(current.name, `image-${active + 1}`, blob.type)
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      // 同一 tick revoke 会被部分浏览器当成取消下载(仓内同款见 ai-career/page.tsx)
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
      setTransfer({ kind: 'save', result: 'success' })
    } catch {
      // 下载被宿主拦下(无手势 / 策略拒绝 / 取体被拒)时**明说失败**,不静默吞
      setTransfer({ kind: 'save', result: 'failed' })
    }
  }, [current.url, current.name, active])

  // G-816000:failed 不是死路 —— 把链接本身交出去(新标签直接取),失败仍如实报失败。
  // 复用 D163 的 openSource 与既有 a11y.download 键,不新增任何文案。
  const handleSaveFallback = React.useCallback(() => {
    openSource()
  }, [openSource])

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

  if (feed.notice === 'expired')
    return (
      <PreviewExpiredState
        copy={copy}
        onRetry={feed.refresh}
        onOpenSource={openSource}
        className={className}
      />
    )

  if (feed.notice === 'too-large')
    return <PreviewTooLargeState copy={copy} onOpenSource={openSource} className={className} />

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
        onRetry={feed.refresh}
      />
      {/*
        G-853 平移层:指针事件挂在这一层 div(不是 img)—— 捕获的是"看图的这块视口",
        松手/取消/卸载三个出口都显式 release,不留幽灵捕获(票面引的上游注释就是这条)。
        touch-action 只在真的能平移时才收走(`none`),未放大保持 `auto` ⇒ 不吃页面滚动。
      */}
      <div
        ref={viewportRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        style={{ touchAction: panReady ? 'none' : 'auto' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        data-image-pan-ready={panReady ? 'true' : 'false'}
        data-image-pan-x={offset.x}
        data-image-pan-y={offset.y}
      >
        {/* G-856,2026-10-07:video 分支 —— 单个持久 <video> 元素(切项不换节点,只换 src),
            loading/ready/unsupported 三态;解码失败只收口当前画廊项,预览壳与翻页不塌。 */}
        {currentIsVideo ? (
          videoState === 'unsupported' ? (
            <p role="alert" className="px-6 text-center text-sm text-muted-foreground">
              {t('videoLoadFailed')}
            </p>
          ) : (
            <>
              {videoState === 'loading' ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {t('loading')}
                </p>
              ) : null}
              <video
                controls
                playsInline
                className={cn(
                  'h-auto w-auto min-h-0 max-h-full max-w-full flex-1 rounded-md object-contain',
                  videoState === 'loading' && 'invisible absolute',
                )}
                data-testid="image-preview-video"
                onError={() => setVideoState('unsupported')}
                onLoadedMetadata={() => setVideoState('ready')}
                ref={videoRef}
                src={current.url}
              >
                {/* a11y:media-has-caption 要求媒体带 track;用户上传视频无字幕源,空 captions track 为规范允许的最小清偿 */}
                <track kind="captions" />
              </video>
            </>
          )
        ) : (
          <Image
            src={current.url}
            alt={current.name ?? 'preview'}
            width={800}
            height={600}
            unoptimized
            className="h-auto w-auto min-h-0 max-h-full max-w-full flex-1 object-contain"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: 'center',
            }}
            data-testid="image-preview-img"
            data-image-zoom={zoomPercent}
          />
        )}
      </div>

      {/* 控件条:多图才给翻页;缩放与保存/复制是图片专属,G-856 起 video 项不渲染
          (对位上游 !activeItemIsVideo 才给下载 —— 不给出注定失败的复制/缩放路径)。 */}
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
        {!currentIsVideo ? (
          <>
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
          </>
        ) : null}
        {!currentIsVideo ? (
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
              onClick={() => void handleSave()}
              aria-label={te('imagePreview.save')}
              data-image-transfer-btn="save"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
            </button>
            {/* G-816000:仅「保存失败」态给兜底出口(成功态不渲染,否则每次成功都多一个按钮)。
                出口只交链接、不改 transfer,故不会把失败洗成 success。 */}
            {transfer?.kind === 'save' && transfer.result === 'failed' ? (
              <button
                type="button"
                className={toolBtn}
                onClick={handleSaveFallback}
                aria-label={t('download')}
                data-image-transfer-btn="save-fallback"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
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
        ) : null}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
