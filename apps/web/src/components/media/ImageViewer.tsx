// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Loader2,
} from 'lucide-react'
import { CloseButton } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

interface ImageViewerProps {
  src: string
  alt?: string
  className?: string
  images?: string[]
  index?: number
}

// G-751(2026-09-29):查看器补加载三态。next/image 语义(onLoad/onError 从 props 接线、
// placeholder 显式 empty 自绘占位),与 G-738 流式内联图(裸 <img> 的 DOM 事件)API 不同,
// 故未直接导出复用其内联状态机;但两条写法纪律**同构复用、判据同源**(不造第二种语义):
// ① **状态↔src 配对** —— state.source !== 当前 src ⇒ 旧状态一律作废视为 loading。判据与
//   G-738 及本仓 use-preview-staleness 的 case 'reset'("url 变了:上一文件的记录必须作废")同源。
// ② **key 按资源重建** —— <Image key={currentSrc}>,换图即换节点,旧资源的迟到 load/error
//   事件不会命中新图的处理器。
type ImageLoadStatus = 'loading' | 'loaded' | 'error'

export function ImageViewer({
  src,
  alt = 'image',
  className,
  images,
  index = 0,
}: ImageViewerProps) {
  const t = useTranslations('a11y')
  // G-738 同款:失败文案复用既有键 ai.toolCall.imageLoadFailed(五语言已在位),不新增语言包键
  const tImage = useTranslations('ai.toolCall')
  const [zoom, setZoom] = React.useState(1)
  const [rotation, setRotation] = React.useState(0)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [current, setCurrent] = React.useState(index)

  const list = images ?? [src]
  const currentSrc = list[current] ?? src

  const [imageState, setImageState] = React.useState<{ source: string; status: ImageLoadStatus }>(
    () => ({ source: currentSrc, status: 'loading' }),
  )
  // 纪律①:状态↔src 配对。state.source !== currentSrc ⇒ 旧状态不可信,视为 loading。
  const effectiveStatus = imageState.source === currentSrc ? imageState.status : 'loading'

  const reset = () => {
    setZoom(1)
    setRotation(0)
  }

  const next = () => {
    setCurrent((current + 1) % list.length)
    reset()
  }

  const prev = () => {
    setCurrent((current - 1 + list.length) % list.length)
    reset()
  }

  // 三态承载(G-738 同款视觉语言):加载中 role="status"(spinner 占位)、失败 role="img"
  // + aria-label(ImageOff 图标,非空白)——两种 aria 语义**分开**,不共用一个承载元素。
  const loadingOverlay = (
    <span
      role="status"
      data-image-viewer-state="loading"
      className="absolute inset-0 flex items-center justify-center gap-1.5 text-xs text-muted-foreground"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {t('loading')}
    </span>
  )
  const errorBlock = (
    <span
      role="img"
      aria-label={tImage('imageLoadFailed')}
      data-image-viewer-state="error"
      className="flex min-h-24 w-full items-center justify-center text-muted-foreground"
    >
      <ImageOff className="h-6 w-6" aria-hidden />
    </span>
  )

  const controls = (
    <div className="flex items-center gap-1 rounded-md bg-black/60 p-1">
      <button
        onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
        aria-label={t('zoomOut')}
        className="rounded-sm p-1.5 text-white hover:bg-white/20"
      >
        <ZoomOut className="h-4 w-4" />
      </button>
      <span className="px-1 text-xs text-white">{Math.round(zoom * 100)}%</span>
      <button
        onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
        aria-label={t('zoomIn')}
        className="rounded-sm p-1.5 text-white hover:bg-white/20"
      >
        <ZoomIn className="h-4 w-4" />
      </button>
      <button
        onClick={() => setRotation((r) => r + 90)}
        aria-label={t('rotate')}
        className="rounded-sm p-1.5 text-white hover:bg-white/20"
      >
        <RotateCw className="h-4 w-4" />
      </button>
      <button
        onClick={() => setFullscreen(true)}
        aria-label={t('fullscreen')}
        className="rounded-sm p-1.5 text-white hover:bg-white/20"
      >
        <Maximize className="h-4 w-4" />
      </button>
    </div>
  )

  return (
    <>
      <div
        className={cn(
          'group relative flex items-center justify-center overflow-hidden rounded-lg bg-muted',
          className,
        )}
      >
        {effectiveStatus === 'error' ? (
          errorBlock
        ) : (
          <>
            {effectiveStatus === 'loading' && loadingOverlay}
            <Image
              // 纪律②:按资源重建节点 —— 换图即换节点,旧资源的迟到事件不命中新图处理器
              key={currentSrc}
              src={currentSrc}
              alt={alt}
              width={1200}
              height={800}
              unoptimized
              // 占位由本组件自绘(role="status"),next/image 层显式 empty
              placeholder="empty"
              onLoad={() => setImageState({ source: currentSrc, status: 'loaded' })}
              onError={() => setImageState({ source: currentSrc, status: 'error' })}
              className={cn(
                'h-auto w-auto max-h-full max-w-full object-contain transition-transform',
                effectiveStatus === 'loading' && 'invisible',
              )}
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            />
          </>
        )}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {controls}
        </div>
        {list.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label={t('previous')}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-sm bg-black/60 p-2 text-white hover:bg-black/80"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              aria-label={t('next')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm bg-black/60 p-2 text-white hover:bg-black/80"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
      {fullscreen && (
        <div
          role="button"
          tabIndex={0}
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/90"
          onClick={() => setFullscreen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setFullscreen(false)
            }
          }}
        >
          {effectiveStatus === 'error' ? (
            errorBlock
          ) : (
            <>
              {effectiveStatus === 'loading' && loadingOverlay}
              <Image
                key={currentSrc}
                src={currentSrc}
                alt={alt}
                width={1200}
                height={800}
                unoptimized
                placeholder="empty"
                onLoad={() => setImageState({ source: currentSrc, status: 'loaded' })}
                onError={() => setImageState({ source: currentSrc, status: 'error' })}
                className={cn(
                  'h-auto w-auto max-h-[90vh] max-w-[90vw] object-contain',
                  effectiveStatus === 'loading' && 'invisible',
                )}
                style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
              />
            </>
          )}
          <div
            role="button"
            tabIndex={0}
            className="absolute bottom-4 left-1/2 -translate-x-1/2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
              }
            }}
          >
            {controls}
          </div>
          {/* 2026-09-16 全项目统一关闭按钮 token:onDark + floating(右上角,与全项目规范一致;
              控制条移到底部居中,与预览态布局统一) */}
          <CloseButton
            onDark
            floating
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation()
              setFullscreen(false)
            }}
          />
        </div>
      )}
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
