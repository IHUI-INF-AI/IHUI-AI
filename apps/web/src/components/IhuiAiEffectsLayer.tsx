'use client'

import * as React from 'react'

interface AnimationItem {
  id: number
  type: 'left' | 'top' | 'opacity'
  top: number
  left: number
  delay: number
}

interface IhuiAiEffectsLayerProps {
  showBackground?: boolean
  animationCount?: number
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 首页视觉特效层:背景图片 + 粒子动画(仅暗色模式显示动画) */
export function IhuiAiEffectsLayer({
  showBackground = true,
  animationCount = 10,
}: IhuiAiEffectsLayerProps) {
  const [items, setItems] = React.useState<AnimationItem[]>([])
  const [imgError, setImgError] = React.useState<{ top: boolean; feature: boolean }>({
    top: false,
    feature: false,
  })

  const initItems = React.useCallback(() => {
    if (typeof window === 'undefined' || prefersReducedMotion()) {
      setItems([])
      return
    }
    const height = window.innerHeight || 800
    const width = window.innerWidth || 1200
    const count =
      width <= 480
        ? Math.min(animationCount, 4)
        : width <= 900
          ? Math.min(animationCount, 7)
          : animationCount
    const types: AnimationItem['type'][] = ['left', 'top', 'opacity']
    setItems(
      Array.from({ length: count }, (_, i) => ({
        id: i,
        type: types[Math.floor(Math.random() * 3)] ?? 'opacity',
        top: Math.random() * height,
        left: Math.random() * width,
        delay: Math.random() * 2,
      })),
    )
  }, [animationCount])

  React.useEffect(() => {
    initItems()
    let rafId: number | null = null
    const handleResize = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        initItems()
      })
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [initItems])

  const showBg = showBackground && !prefersReducedMotion()

  return (
    <div className="ihui-ai-effects-layer">
      {showBg && (
        <div className="ihui-ai-background-layer">
          {!imgError.top && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/images/ihui-ai/bgtop.png"
              alt=""
              className="ihui-ai-bg-top"
              loading="lazy"
              onError={() => setImgError((p) => ({ ...p, top: true }))}
            />
          )}
          {!imgError.feature && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/images/ihui-ai/featurebg.png"
              alt=""
              className="ihui-ai-bg-feature"
              loading="lazy"
              onError={() => setImgError((p) => ({ ...p, feature: true }))}
            />
          )}
        </div>
      )}
      <div className="ihui-ai-animations-layer">
        {items.map((item) => (
          <div
            key={item.id}
            className={`ihui-ai-animation-item ihui-ai-fade-in-${item.type}`}
            style={{
              top: `${item.top}px`,
              left: `${item.left}px`,
              animationDelay: `${item.delay}s`,
            }}
          >
            <div className="ihui-ai-particle" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default IhuiAiEffectsLayer
