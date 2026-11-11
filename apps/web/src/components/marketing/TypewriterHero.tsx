// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MessageSquare, GraduationCap } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { useMounted } from '@/hooks/use-mounted'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useChatStore } from '@/stores/chat'

/**
 * 第 1 页:打字机欢迎语 + 2 CTA
 *
 * 还原自原版 client/src/views/Home.vue 的 first-page 区块。
 * 功能:
 *  - WELCOME IHUI INF . AI 品牌欢迎语(EDIX 字体)
 *  - 打字机效果(typing-text + cursor-blink)轮播 4 句话
 *  - 2 CTA:立即体验 / 了解更多
 *  - prefers-reduced-motion 降级(静态显示首句)
 */

const TYPE_SPEED = 120
const DELETE_SPEED = 60
const FULL_PAUSE = 2000
const SWITCH_PAUSE = 500

function TypewriterHero() {
  const t = useTranslations('marketing.typewriter')
  const tw = useTranslations('marketing.welcome')
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
      <h1 className="font-edix text-display font-bold tracking-tight text-primary min-[768px]:text-3xl min-[1024px]:text-5xl min-[1280px]:text-6xl">
        WELCOME IHUI INF . AI
      </h1>
      <p className="mt-2 text-body font-semibold tracking-tight text-foreground/90 min-[768px]:mt-3 min-[768px]:text-base">
        {tw('brandSubtitle')}
      </p>
      <p className="mt-4 min-h-[1.75rem] text-base text-foreground/80 min-[768px]:mt-6 min-[768px]:text-lg">
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

export function TypewriterHeroSection() {
  const t = useTranslations('marketing')
  const router = useRouter()
  const openPanel = useAiPanelStore((s) => s.openPanel)

  // 2026-09-08 改:不再跳转 /ask(问答社区),改为拉起 AI 侧边面板 + 预填「你是什么模型？」
  // 并自动发送(draftInput + draftAutoSend 由 MessageInput 消费),直接发起对话
  const handleOpenChat = () => {
    useChatStore.setState({ draftInput: '你是什么模型？', draftAutoSend: true })
    openPanel()
  }
  const handleLearnMore = () => router.push('/learn')

  return (
    // 2026-07-20 改:去掉 py-8 min-[768px]:py-12(父容器已用 pt-8 min-[768px]:pt-12 留顶间距,
    // 内部再叠加 48px 顶部 padding 会导致内容"悬空居中",hero 视觉不主导)
    <div className="flex w-full flex-col items-center gap-6">
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
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
