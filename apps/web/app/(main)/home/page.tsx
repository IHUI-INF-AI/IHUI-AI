'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@ihui/ui'
import { Marquee } from '@/components/marketing/Marquee'
import { HomePage3Magazine } from '@/components/marketing/HomePage3Magazine'
import { HomePage4Pricing } from '@/components/marketing/HomePage4Pricing'
import { HomeFeatureGrid } from '@/components/marketing/HomeFeatureGrid'
import { TypewriterHeroSection } from '@/components/marketing/TypewriterHero'
import { useAiPanelStore } from '@/stores/ai-panel'

/**
 * 工作区版首页(/home)
 *
 * 与根路径 `/` 全屏营销落地页的区别:
 * - 路由在 (main) 路由组下,自动套用 MainShell(左侧 sidebar + 右侧工作区圆角面板)
 * - 不使用全屏 scroll-snap,改用卡片式垂直流式布局
 * - 移除 PageIndicator / ScrollDownButton(工作区有自身滚动条)
 * - 移除 SiteFooter(工作区不需要 footer)
 * - 各区块用卡片容器 + gap-6 间距,适配工作区 padding
 *
 * 首次进入 /home 时自动展开 AI 对话面板(首页作为用户中心枢纽,AI 助手默认可见)
 * useRef 防止 React StrictMode 双调用重复触发 openPanel
 */
export default function WorkAreaHomePage() {
  const t = useTranslations('marketing')
  const router = useRouter()
  const openPanel = useAiPanelStore((s) => s.openPanel)

  const handleJoin = () => router.push('/support?source=landing')

  // 首次进入 /home 时自动展开 AI 对话面板(首页作为用户中心枢纽)
  // useRef 防止 React StrictMode 双调用导致重复触发
  const openedRef = React.useRef(false)
  React.useEffect(() => {
    if (openedRef.current) return
    openedRef.current = true
    openPanel()
  }, [openPanel])

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6">
      {/* 1. Hero:打字机欢迎语 + Marquee 公告条 */}
      <section
        aria-label={t('indicator.page1')}
        className="overflow-hidden rounded-xl border bg-gradient-to-br from-primary/5 via-card to-emerald-500/5 shadow-sm"
      >
        <div className="flex flex-col items-center gap-4 px-4 py-8 md:px-8 md:py-10">
          <TypewriterHeroSection />
          <div className="w-full max-w-3xl">
            <Marquee />
          </div>
        </div>
      </section>

      {/* 2. 欢迎语 + 价格 + Benefits + CTA */}
      <section
        aria-label={t('indicator.page2')}
        className="overflow-hidden rounded-xl border bg-card shadow-sm"
      >
        <div className="grid gap-6 p-6 md:grid-cols-2 md:p-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {t('welcome.title')}
            </div>
            <h2 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">
              {t('welcome.subtitle')}
            </h2>
            <p className="text-sm text-muted-foreground md:text-base">{t('welcome.description')}</p>
          </div>
          <div className="flex flex-col justify-center gap-3 rounded-lg border bg-background/50 p-5">
            <div className="text-center">
              <div className="text-xs text-muted-foreground line-through">¥18000</div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-bold tracking-tight text-primary md:text-4xl">
                  ¥6000
                </span>
                <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                  -67%
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{t('welcome.perYear')}</div>
            </div>
            <Button size="lg" onClick={handleJoin} className="w-full">
              {t('cta.join')}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">{t('cta.subtitle')}</p>
          </div>
        </div>
      </section>

      {/* 3. 5 特性 + 4 优势 */}
      <section
        aria-label={t('indicator.page3')}
        className="rounded-xl border bg-card p-6 shadow-sm md:p-8"
      >
        <HomeFeatureGrid />
      </section>

      {/* 4. 杂志新闻 */}
      <section
        aria-label={t('indicator.page4')}
        className="rounded-xl border bg-card p-6 shadow-sm md:p-8"
      >
        <HomePage3Magazine />
      </section>

      {/* 5. 4 定价卡片 */}
      <section
        aria-label={t('indicator.page5')}
        className="rounded-xl border bg-card p-6 shadow-sm md:p-8"
      >
        <HomePage4Pricing />
      </section>

      {/* 6. 底部 CTA */}
      <section
        aria-label={t('cta.title')}
        className="overflow-hidden rounded-xl border bg-primary/5 p-6 text-center shadow-sm md:p-10"
      >
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t('cta.title')}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
          {t('cta.subtitle')}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={handleJoin}>
            {t('cta.join')}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/dashboard">{t('cta.dashboard')}</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
