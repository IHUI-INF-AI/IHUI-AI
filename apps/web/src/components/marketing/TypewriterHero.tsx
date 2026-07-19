'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Smartphone, MessageSquare, GraduationCap, X } from 'lucide-react'
import { Button } from '@ihui/ui'
import { useMounted } from '@/hooks/use-mounted'

/**
 * 第 1 页:打字机欢迎语 + 3 CTA + 小程序二维码弹窗
 *
 * 还原自原版 client/src/views/Home.vue 的 first-page 区块。
 * 功能:
 *  - WELCOME IHUI INF . AI 品牌欢迎语(EDIX 字体)
 *  - 打字机效果(typing-text + cursor-blink)轮播 4 句话
 *  - 3 CTA:立即体验 / 了解更多 / 微信小程序
 *  - 小程序二维码弹窗(ESC 关闭 + 背景滚动锁定)
 *  - prefers-reduced-motion 降级(静态显示首句)
 */

const TYPE_SPEED = 120
const DELETE_SPEED = 60
const FULL_PAUSE = 2000
const SWITCH_PAUSE = 500

function TypewriterHero() {
  const t = useTranslations('marketing.typewriter')
  const mounted = useMounted()

  // 打字机短语列表(SSR 期间用空数组,挂载后才取真实文案,避免 hydration mismatch)
  const phrases = React.useMemo(() => {
    if (!mounted) return [] as string[]
    return [t('content'), t('explore'), t('brand'), t('connect')]
  }, [mounted, t])

  const [text, setText] = React.useState('')
  const phraseIdxRef = React.useRef(0)
  const charIdxRef = React.useRef(0)
  const deletingRef = React.useRef(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const reduceMotionRef = React.useRef(false)

  const tick = React.useCallback(() => {
    const list = phrases
    if (!list.length) return
    const current = list[phraseIdxRef.current]
    if (!current) {
      phraseIdxRef.current = (phraseIdxRef.current + 1) % list.length
      timerRef.current = setTimeout(tick, SWITCH_PAUSE)
      return
    }
    let speed: number
    if (deletingRef.current) {
      if (charIdxRef.current <= 0) {
        deletingRef.current = false
        phraseIdxRef.current = (phraseIdxRef.current + 1) % list.length
        setText('')
        charIdxRef.current = 0
        speed = SWITCH_PAUSE
      } else {
        charIdxRef.current -= 1
        setText(current.substring(0, charIdxRef.current))
        speed = DELETE_SPEED
      }
    } else {
      setText(current.substring(0, charIdxRef.current + 1))
      charIdxRef.current += 1
      if (charIdxRef.current >= current.length) {
        deletingRef.current = true
        speed = FULL_PAUSE
      } else {
        speed = TYPE_SPEED
      }
    }
    timerRef.current = setTimeout(tick, speed)
  }, [phrases])

  React.useEffect(() => {
    if (!mounted || phrases.length === 0) return
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduceMotionRef.current = mql.matches
    if (mql.matches) {
      setText(phrases[0] ?? '')
      return
    }
    timerRef.current = setTimeout(tick, SWITCH_PAUSE)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [mounted, phrases, tick])

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <h1 className="font-edix text-3xl font-bold tracking-tight text-primary md:text-5xl lg:text-6xl">
        WELCOME IHUI INF . AI
      </h1>
      <p className="mt-4 min-h-[1.75rem] text-base text-foreground/80 md:mt-6 md:text-lg">
        <span>{text}</span>
        {!reduceMotionRef.current && (
          <span
            className="ml-0.5 inline-block w-[2px] animate-pulse bg-foreground align-middle"
            aria-hidden
          >
            &nbsp;
          </span>
        )}
      </p>
    </div>
  )
}

/** 小程序二维码弹窗(ESC 关闭 + 背景滚动锁定) */
function MiniAppQrModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('marketing.miniappModal')

  React.useEffect(() => {
    if (!open) return
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeydown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeydown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="w-full max-w-xs rounded-2xl border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3">
          <span className="text-sm font-semibold">{t('title')}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col items-center gap-3 pt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/footer/erweima/footer-icon-2.png"
            alt={t('qrAlt')}
            className="h-48 w-48 rounded-lg border object-contain"
          />
          <p className="text-center text-xs text-muted-foreground">{t('scanTip')}</p>
        </div>
      </div>
    </div>
  )
}

export function TypewriterHeroSection() {
  const t = useTranslations('marketing')
  const router = useRouter()
  const [modalOpen, setModalOpen] = React.useState(false)

  const handleOpenChat = () => router.push('/ask')
  const handleLearnMore = () => router.push('/learn')

  return (
    <div className="flex w-full flex-col items-center gap-6 py-8 md:py-12">
      <TypewriterHero />

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" onClick={handleOpenChat} aria-label={t('typewriter.ctaPrimary')}>
          <MessageSquare className="mr-1.5 h-4 w-4" />
          {t('typewriter.ctaPrimary')}
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={handleLearnMore}
          aria-label={t('typewriter.ctaSecondary')}
        >
          <GraduationCap className="mr-1.5 h-4 w-4" />
          {t('typewriter.ctaSecondary')}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          onClick={() => setModalOpen(true)}
          aria-label={t('typewriter.miniappBtn')}
        >
          <Smartphone className="mr-1.5 h-4 w-4" />
          {t('typewriter.miniappBtn')}
        </Button>
      </div>

      <MiniAppQrModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
