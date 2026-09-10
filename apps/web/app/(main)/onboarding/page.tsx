// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 新用户接入引导(P3-10):五步 checklist(配置模型→首次对话→Agent 执行→
// 时间线回放→成本与价表)+ MCP 能力入口,localStorage 记忆完成态。
// 零配置跑通文档:docs/ONBOARDING.md。

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  Coins,
  History,
  MessageSquare,
  Network,
  Wrench,
} from 'lucide-react'

import { cn } from '@/lib/utils'

const STEPS: Array<{
  key: 'step1' | 'step2' | 'step3' | 'step4' | 'step5'
  href: string
  icon: typeof Wrench
}> = [
  { key: 'step1', href: '/settings', icon: Wrench },
  { key: 'step2', href: '/', icon: MessageSquare },
  { key: 'step3', href: '/agent-workbench', icon: ArrowRight },
  { key: 'step4', href: '/agent-timeline', icon: History },
  { key: 'step5', href: '/admin/ai-cost', icon: Coins },
]

// 静态 key 映射(i18n 死键扫描要求字面量;动态模板 key 会逃过守门)
const STEP_TITLE_KEY: Record<'step1' | 'step2' | 'step3' | 'step4' | 'step5', string> = {
  step1: 'step1Title',
  step2: 'step2Title',
  step3: 'step3Title',
  step4: 'step4Title',
  step5: 'step5Title',
}
const STEP_DESC_KEY: Record<'step1' | 'step2' | 'step3' | 'step4' | 'step5', string> = {
  step1: 'step1Desc',
  step2: 'step2Desc',
  step3: 'step3Desc',
  step4: 'step4Desc',
  step5: 'step5Desc',
}

const STORAGE_KEY = 'ihui-onboarding-done'

export default function OnboardingPage() {
  const t = useTranslations('onboarding')
  const [done, setDone] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setDone(new Set(JSON.parse(raw) as string[]))
    } catch {
      // 存储不可用(隐私模式)时静默降级为不记忆
    }
  }, [])

  const toggle = (key: string) => {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // 同上,静默降级
      }
      return next
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <div className="mb-2 flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">{t('subtitle')}</p>

      <ul className="space-y-3">
        {STEPS.map(({ key, href, icon: Icon }) => {
          const isDone = done.has(key)
          return (
            <li key={key}>
              <div
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-4 transition',
                  isDone ? 'bg-muted/40' : 'hover:bg-muted/20',
                )}
              >
                <button
                  onClick={() => toggle(key)}
                  className="mt-0.5 shrink-0"
                  aria-label={t('markDone')}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/50" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        isDone && 'text-muted-foreground line-through',
                      )}
                    >
                      {t(STEP_TITLE_KEY[key])}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{t(STEP_DESC_KEY[key])}</p>
                </div>
                <Link
                  href={href}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition hover:bg-muted"
                >
                  {t('go')} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border p-4">
        <Network className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">{t('mcpTitle')}</span>
        <span className="text-sm text-muted-foreground">{t('mcpDesc')}</span>
        <span className="ml-auto inline-flex items-center gap-2 text-sm">
          <Link
            href="/mcp-store"
            className="rounded-lg border px-3 py-1.5 transition hover:bg-muted"
          >
            {t('mcpStore')}
          </Link>
          <Link
            href="/capability-market"
            className="rounded-lg border px-3 py-1.5 transition hover:bg-muted"
          >
            {t('capabilityMarket')}
          </Link>
        </span>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">{t('deployNote')}</p>
    </div>
  )
}
