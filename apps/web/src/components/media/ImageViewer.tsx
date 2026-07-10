'use client'

import * as React from 'react'
import { ZoomIn, ZoomOut, RotateCw, Maximize, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageViewerProps {
  src: string
  alt?: string
  className?: string
  images?: string[]
  index?: number
}

export function ImageViewer({ src, alt = 'image', className, images, index = 0 }: ImageViewerProps) {
  const [zoom, setZoom] = React.useState(1)
  const [rotation, setRotation] = React.useState(0)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [current, setCurrent] = React.useState(index)

  const list = images ?? [src]
  const currentSrc = images ? images[current] : src

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
      <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="rounded p-1.5 text-white hover:bg-white/20">
        <ZoomOut className="h-4 w-4" />
      </button>
      <span className="px-1 text-xs text-white">{Math.round(zoom * 100)}%</span>
      <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="rounded p-1.5 text-white hover:bg-white/20">
        <ZoomIn className="h-4 w-4" />
      </button>
      <button onClick={() => setRotation((r) => r + 90)} className="rounded p-1.5 text-white hover:bg-white/20">
        <RotateCw className="h-4 w-4" />
      </button>
      <button onClick={() => setFullscreen(true)} className="rounded p-1.5 text-white hover:bg-white/20">
        <Maximize className="h-4 w-4" />
      </button>
    </div>
  )

  return (
    <>
      <div className={cn('group relative flex items-center justify-center overflow-hidden rounded-lg bg-muted', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentSrc}
          alt={alt}
          className="max-h-full max-w-full object-contain transition-transform"
          style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
        />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
          {controls}
        </div>
        {list.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
      {fullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setFullscreen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentSrc}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
          />
          <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
            {controls}
          </div>
          <button onClick={() => setFullscreen(false)} className="absolute top-4 left-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </>
  )
}
