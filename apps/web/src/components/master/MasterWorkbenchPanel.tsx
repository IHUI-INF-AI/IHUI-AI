// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管 · 今日面板(2026-11-28 用户定档)。
 *
 * 工作台不再单独占一个侧栏入口,也不再作为独立标签出现;
 * 它是总管工作展示区的默认"今日"面:今日队列 + 八张能力卡。
 * 左栏总管聊天保留,用户可以直接从左边说,也可以从右边挑一件已有的活。
 */
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  GraduationCap,
  Image as ImageIcon,
  PenLine,
  Send,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { START_SERVICES, type StartServiceIcon } from '@/config/start-services'

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

interface QueueStats {
  draft: number
  scheduled: number
  running: number
  failed: number
}

export function MasterWorkbenchPanel() {
  const [queue, setQueue] = useState<QueueStats | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchApi<{
      tasks?: { draft?: number; scheduled?: number; failed?: number; running?: number }
    }>('/api/publish/stats?days=30')
      .then((result) => {
        if (cancelled || !result.success || !result.data?.tasks) return
        setQueue({
          draft: result.data.tasks.draft ?? 0,
          scheduled: result.data.tasks.scheduled ?? 0,
          running: result.data.tasks.running ?? 0,
          failed: result.data.tasks.failed ?? 0,
        })
      })
      .catch(() => {
        // 队列只做加速;统计不可用时静默隐藏,不挡八卡。
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="flex h-full min-h-0 flex-col bg-transparent">
      <header className="shrink-0 border-b border-[#f0ebe3] px-7 py-6">
        <p className="text-[10px] font-medium tracking-[0.16em] text-[#a29a8e]">
          AI总管 · 今日
        </p>
        <h2 className="mt-1 text-[22px] font-semibold leading-8 text-[#23211c]">
          今天要做什么
        </h2>
        <p className="mt-1 text-[12px] text-[#8d8579]">
          从下面挑一件开始；也可以直接在左边跟总管说，让它安排。
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-8">
        {queue && (
          <section className="pt-5" aria-labelledby="master-workbench-queue-title">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="master-workbench-queue-title" className="text-[14px] font-semibold text-[#2c2823]">
                今日队列
              </h3>
              <span className="text-[11px] text-[#aaa298]">最近 30 天</span>
            </div>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
            >
              {[
                { key: 'draft', label: '待确认草稿', value: queue.draft },
                { key: 'scheduled', label: '已排期', value: queue.scheduled },
                { key: 'running', label: '发布中', value: queue.running },
                { key: 'failed', label: '失败待处理', value: queue.failed },
              ].map((item) => (
                <Link
                  key={item.key}
                  href="/publish/history"
                  className="rounded-xl border border-[#eee9e1] bg-[#fbfaf7] px-4 py-3 transition hover:border-[#ddd5c8] hover:bg-white"
                >
                  <span className="text-[11px] text-[#8d8579]">{item.label}</span>
                  <span className="mt-1 block text-[20px] font-semibold tabular-nums text-[#2c2823]">
                    {item.value}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="pt-7" aria-labelledby="master-workbench-services-title">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3
              id="master-workbench-services-title"
              className="text-[14px] font-semibold text-[#2c2823]"
            >
              或者，从一件事开始
            </h3>
            <span className="text-[11px] text-[#aaa298]">八张卡，点进去就是对应模块</span>
          </div>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
            {START_SERVICES.map((service) => {
              const Icon = ICONS[service.icon]
              return (
                <Link
                  key={service.id}
                  href={service.href}
                  aria-label={`${service.title}：${service.desc}`}
                  className="group flex min-h-[136px] flex-col rounded-2xl border border-[#eee9e1] bg-[#fbfaf7] p-4 transition hover:border-[#ddd5c8] hover:bg-white hover:shadow-[0_6px_20px_rgba(34,28,18,0.05)]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#efebe3] text-[#5a5449]">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-[14px] font-semibold leading-5 text-[#2c2823]">
                    {service.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 flex-1 text-[11px] leading-4 text-[#8d8579]">
                    {service.desc}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#8a6a2f]">
                    进入
                    <ArrowRight
                      className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      </div>
    </section>
  )
}
