// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import Link from 'next/link'
import * as React from 'react'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  GraduationCap,
  Image as ImageIcon,
  PenLine,
  Send,
  Sparkles,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui-react'

import { START_SERVICES, type StartServiceIcon } from '@/config/start-services'
import { fetchApi } from '@/lib/api'
import { useAiPanelStore } from '@/stores/ai-panel'

const ICONS: Record<StartServiceIcon, LucideIcon> = {
  pen: PenLine,
  send: Send,
  chart: BarChart3,
  users: Users,
  book: BookOpen,
  image: ImageIcon,
  cap: GraduationCap,
  wrench: Wrench,
}

export default function StartClient() {
  const openPanel = useAiPanelStore((s) => s.openPanel)
  const [queue, setQueue] = React.useState<{
    draft: number
    scheduled: number
    failed: number
    running: number
  } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void fetchApi<{
      tasks?: { draft?: number; scheduled?: number; failed?: number; running?: number }
    }>('/api/publish/stats?days=30')
      .then((r) => {
        if (cancelled || !r.success || !r.data?.tasks) return
        setQueue({
          draft: r.data.tasks.draft ?? 0,
          scheduled: r.data.tasks.scheduled ?? 0,
          failed: r.data.tasks.failed ?? 0,
          running: r.data.tasks.running ?? 0,
        })
      })
      .catch(() => {
        // 队列只是加速入口;统计不可用时静默隐藏,不阻塞八卡。
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <section className="max-w-2xl">
        <p className="text-caption font-medium tracking-wider text-muted-foreground">
          智汇AI · 一个入口
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          说一句话，剩下的交给 AI
        </h1>
        <p className="mt-3 text-body leading-relaxed text-muted-foreground">
          内容、发布、数据、账号，一条链路从头做到尾。不想说，就从下面挑一件。
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={openPanel} className="gap-2">
            <Sparkles className="h-4 w-4" aria-hidden />
            和 AI 说一句话
          </Button>
          <span className="text-caption text-muted-foreground">
            不用先挑模型，直接说你要什么
          </span>
        </div>
      </section>

      {queue && (
        <section className="mt-8" aria-labelledby="start-queue-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="start-queue-title" className="text-body font-medium">
              今日队列
            </h2>
            <span className="text-caption text-muted-foreground">最近 30 天</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { key: 'draft', label: '待确认草稿', value: queue.draft, href: '/publish/history' },
              { key: 'scheduled', label: '已排期', value: queue.scheduled, href: '/publish/history' },
              { key: 'running', label: '发布中', value: queue.running, href: '/publish/history' },
              { key: 'failed', label: '失败待处理', value: queue.failed, href: '/publish/history' },
            ].map((item) => (
              <Link key={item.key} href={item.href} className="block">
                <Card className="transition-colors hover:bg-muted/40">
                  <CardContent className="p-4">
                    <div className="text-caption text-muted-foreground">{item.label}</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10" aria-labelledby="start-services-title">
        <h2 id="start-services-title" className="text-body font-medium">
          或者，从一件事开始
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {START_SERVICES.map((service) => {
            const Icon = ICONS[service.icon]
            return (
              <Link
                key={service.id}
                href={service.href}
                aria-label={`${service.title}：${service.desc}`}
                className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full transition-colors group-hover:bg-muted/40">
                  <CardContent className="flex h-full flex-col p-4">
                    <Icon className="h-5 w-5 text-primary" aria-hidden />
                    <h3 className="mt-3 text-body font-medium">{service.title}</h3>
                    <p className="mt-1 flex-1 text-caption leading-relaxed text-muted-foreground">
                      {service.desc}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-caption text-primary">
                      进入
                      <ArrowRight
                        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
