// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Image from 'next/image'
import { ZoomIn, ZoomOut, RotateCw, Maximize, ChevronLeft, ChevronRight } from 'lucide-react'
import { CloseButton } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

interface ImageViewerProps {
  src: string
  alt?: string
  className?: string
  images?: string[]
  index?: number
}

export function ImageViewer({
  src,
  alt = 'image',
  className,
  images,
  index = 0,
}: ImageViewerProps) {
  const [zoom, setZoom] = React.useState(1)
  const [rotation, setRotation] = React.useState(0)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [current, setCurrent] = React.useState(index)

  const list = images ?? [src]
  const currentSrc = list[current] ?? src

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

  const controls = (
    <div className="flex items-center gap-1 rounded-md bg-black/60 p-1">
      <button
        onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
        className="rounded p-1.5 text-white hover:bg-white/20"
      >
        <ZoomOut className="h-4 w-4" />
      </button>
      <span className="px-1 text-xs text-white">{Math.round(zoom * 100)}%</span>
      <button
        onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
        className="rounded p-1.5 text-white hover:bg-white/20"
      >
        <ZoomIn className="h-4 w-4" />
      </button>
      <button
        onClick={() => setRotation((r) => r + 90)}
        className="rounded p-1.5 text-white hover:bg-white/20"
      >
        <RotateCw className="h-4 w-4" />
      </button>
      <button
        onClick={() => setFullscreen(true)}
        className="rounded p-1.5 text-white hover:bg-white/20"
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
        <Image
          src={currentSrc}
          alt={alt}
          width={1200}
          height={800}
          unoptimized
          className="h-auto w-auto max-h-full max-w-full object-contain transition-transform"
          style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
        />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {controls}
        </div>
        {list.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md bg-black/60 p-2 text-white hover:bg-black/80"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-black/60 p-2 text-white hover:bg-black/80"
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
          <Image
            src={currentSrc}
            alt={alt}
            width={1200}
            height={800}
            unoptimized
            className="h-auto w-auto max-h-[90vh] max-w-[90vw] object-contain"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
          />
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
