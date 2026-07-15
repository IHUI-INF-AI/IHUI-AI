'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui'

interface Slide {
  titleKey: string
  subtitleKey: string
  ctaKey: string
  href: string
  gradient: string
}

const SLIDES: Slide[] = [
  {
    titleKey: 'slide1Title',
    subtitleKey: 'slide1Subtitle',
    ctaKey: 'slide1Cta',
    href: '/learn',
    gradient: 'from-primary/80 via-primary/60 to-emerald-400/50',
  },
  {
    titleKey: 'slide2Title',
    subtitleKey: 'slide2Subtitle',
    ctaKey: 'slide2Cta',
    href: '/live',
    gradient: 'from-primary/70 via-emerald-500/50 to-teal-400/40',
  },
  {
    titleKey: 'slide3Title',
    subtitleKey: 'slide3Subtitle',
    ctaKey: 'slide3Cta',
    href: '/exam',
    gradient: 'from-violet-500/70 via-purple-500/50 to-indigo-400/40',
  },
]

export function HomeBanner() {
  const t = useTranslations('home.banner')
  const [current, setCurrent] = React.useState(0)
  const [paused, setPaused] = React.useState(false)

  React.useEffect(() => {
    if (paused) return
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [paused])

  const goTo = (idx: number) => setCurrent(idx)

  return (
    <div
      className="relative min-h-[200px] flex-1 p-4 md:min-h-[340px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative h-full min-h-[180px] overflow-hidden rounded-lg md:min-h-[300px]">
        {SLIDES.map((slide, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 flex flex-col justify-center bg-gradient-to-br ${slide.gradient} px-8 transition-opacity duration-500 ${
              idx === current ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <h2 className="max-w-md text-2xl font-bold text-white drop-shadow md:text-3xl">
              {t(slide.titleKey)}
            </h2>
            <p className="mt-2 max-w-sm text-sm text-white/80 md:text-base">
              {t(slide.subtitleKey)}
            </p>
            <Link href={slide.href} className="mt-4 inline-block w-fit">
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/90 text-foreground hover:bg-white"
              >
                {t(slide.ctaKey)}
              </Button>
            </Link>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-1.5">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            className={`h-1.5 rounded-full transition-all ${
              idx === current ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
            }`}
            aria-label={t('switchTo', { index: idx + 1 })}
          />
        ))}
      </div>
    </div>
  )
}
