'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@ihui/ui'

interface Slide {
  /** i18n key 后缀(自动拼接到 namespace) */
  titleKey: string
  subtitleKey: string
  ctaKey: string
  href: string
  gradient: string
}

/**
 * 默认 slides 配置 - 营销首页用 marketing.hero 命名空间
 * 5 张:企业服务 / 课程 / 直播 / 智能体 / 资讯
 */
const DEFAULT_SLIDES: Slide[] = [
  {
    titleKey: 'slide1Title',
    subtitleKey: 'slide1Subtitle',
    ctaKey: 'slide1Cta',
    href: '/enterprise',
    gradient: 'from-primary/85 via-primary/65 to-emerald-400/50',
  },
  {
    titleKey: 'slide2Title',
    subtitleKey: 'slide2Subtitle',
    ctaKey: 'slide2Cta',
    href: '/learn',
    gradient: 'from-violet-600/80 via-purple-500/60 to-indigo-400/45',
  },
  {
    titleKey: 'slide3Title',
    subtitleKey: 'slide3Subtitle',
    ctaKey: 'slide3Cta',
    href: '/live',
    gradient: 'from-sky-600/80 via-blue-500/60 to-cyan-400/45',
  },
  {
    titleKey: 'slide4Title',
    subtitleKey: 'slide4Subtitle',
    ctaKey: 'slide4Cta',
    href: '/agents',
    gradient: 'from-rose-600/80 via-pink-500/60 to-orange-400/45',
  },
  {
    titleKey: 'slide5Title',
    subtitleKey: 'slide5Subtitle',
    ctaKey: 'slide5Cta',
    href: '/news',
    gradient: 'from-emerald-600/80 via-teal-500/60 to-green-400/45',
  },
]

interface HeroCarouselProps {
  /** 自定义 slides,默认用营销首页 5 张配置 */
  slides?: Slide[]
  /** i18n 命名空间,默认 'marketing.hero' */
  namespace?: string
}

export function HeroCarousel({
  slides = DEFAULT_SLIDES,
  namespace = 'marketing.hero',
}: HeroCarouselProps) {
  const t = useTranslations(namespace)
  const [current, setCurrent] = React.useState(0)
  const [paused, setPaused] = React.useState(false)

  React.useEffect(() => {
    if (paused) return
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [paused, slides.length])

  return (
    <div
      className="relative flex min-h-[420px] overflow-hidden rounded-2xl border bg-card shadow-sm md:min-h-[480px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* 幻灯片 */}
      {slides.map((slide, idx) => (
        <div
          key={idx}
          className={`absolute inset-0 flex flex-col justify-center bg-gradient-to-br ${slide.gradient} px-8 transition-opacity duration-700 md:px-16 ${
            idx === current ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <h2 className="max-w-2xl text-3xl font-bold text-white drop-shadow-lg md:text-5xl">
            {t(slide.titleKey)}
          </h2>
          <p className="mt-3 max-w-xl text-sm text-white/85 md:text-lg">{t(slide.subtitleKey)}</p>
          <Link href={slide.href} className="mt-6 inline-block w-fit">
            <Button
              size="lg"
              variant="secondary"
              className="bg-white/95 text-zinc-900 hover:bg-white"
            >
              {t(slide.ctaKey)}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>
      ))}

      {/* 品牌标识 */}
      <div className="absolute left-6 top-5 z-10 flex items-center gap-2 text-white/90">
        <Sparkles className="h-5 w-5" />
        <span className="text-sm font-medium tracking-wide">{t('brandLabel')}</span>
      </div>

      {/* 右侧 5 个分页指示器 */}
      <div className="absolute right-5 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2.5">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            aria-label={t('switchTo', { index: idx + 1 })}
            className={`group relative flex h-10 w-2.5 items-center transition-all ${
              idx === current ? 'h-10 w-2.5' : 'h-2.5 w-2.5'
            }`}
          >
            <span
              className={`block w-full rounded-full transition-all ${
                idx === current ? 'bg-white' : 'bg-white/40 hover:bg-white/70'
              }`}
            />
          </button>
        ))}
      </div>

      {/* 底部进度条 */}
      <div className="absolute bottom-0 left-0 h-1 w-full bg-black/15">
        <div
          key={current}
          className={`h-full bg-white/85 ${paused ? '' : 'animate-hero-progress'}`}
        />
      </div>
    </div>
  )
}
