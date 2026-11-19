// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronDown, LayoutGrid, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useCapabilityApps } from '@/hooks/use-capability-apps'
import { CapabilityAppIcon, CapabilityAppRenderer } from './app-renderer'

/**
 * 能力应用右栏(2026-11-13 立)
 *
 * 承载体:除 `page` 外的落点(sidebar-right / sidebar-left / chat-dock / shell-overlay)
 * 统一由这一处渲染 —— 一处宿主,四种语义,不做四套挂载逻辑。
 * `page` 落点由 /apps/[id] 承接(与这里共用同一个 CapabilityAppRenderer)。
 *
 * 可见性:未登录直接不渲染(不请求、不占位);有应用时右下角出现入口。
 */
export function CapabilityAppRail() {
  const t = useTranslations('apps')
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const { apps } = useCapabilityApps()
  const [open, setOpen] = React.useState(false)
  const [activeId, setActiveId] = React.useState<string | null>(null)

  const railApps = React.useMemo(() => apps.filter((app) => app.slot !== 'page'), [apps])
  const active = railApps.find((app) => app.id === activeId) ?? railApps[0] ?? null

  if (!isAuthenticated || railApps.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {open ? (
        <div className="pointer-events-auto flex max-h-[70vh] w-[min(92vw,380px)] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <LayoutGrid className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="text-body font-medium">{t('railTitle')}</span>
            <Link href="/apps" className="font-[weight:inherit] ml-auto text-label text-primary hover:underline">
              {t('railManage')}
            </Link>
            <button
              type="button"
              aria-label={t('railClose')}
              onClick={() => setOpen(false)}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-1.5">
            {railApps.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => setActiveId(app.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-label',
                  app.id === active?.id
                    ? 'bg-muted font-medium'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <CapabilityAppIcon name={app.icon} className="h-3.5 w-3.5" />
                {app.title}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {active ? <CapabilityAppRenderer app={active} /> : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="font-[weight:inherit] pointer-events-auto flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-body shadow-lg hover:bg-muted"
        aria-expanded={open}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden />
        {t('railTitle')}
        <span className="rounded-full bg-cta px-1.5 text-[11px] font-medium text-cta-foreground">
          {railApps.length}
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
