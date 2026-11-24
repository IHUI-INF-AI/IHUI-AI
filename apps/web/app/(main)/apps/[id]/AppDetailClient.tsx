// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { getCapabilityApp } from '@ihui/api-client'
import type { CapabilityAppRecord } from '@ihui/types'
import { PageContainer } from '@/components/common'
import { CapabilityAppIcon, CapabilityAppRenderer } from '@/components/capability-app/app-renderer'

/**
 * 应用详情页:按 id 拉取定义并渲染。
 *
 * 说明:这是「page」落点的真实承载体 —— 渲染器与侧栏/对话内落点共用同一份
 * CapabilityAppRenderer,不另造第二套渲染实现。
 */
export default function AppDetailClient() {
  const params = useParams<{ id: string }>()
  const id = typeof params?.id === 'string' ? decodeURIComponent(params.id) : ''
  const [app, setApp] = React.useState<CapabilityAppRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!id) {
      setLoading(false)
      setError('缺少应用 id')
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    getCapabilityApp(id)
      .then((record) => {
        if (!cancelled) setApp(record)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '应用不存在或加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <PageContainer className="space-y-4">
      <Link
        href="/apps"
        className="font-[weight:inherit] inline-flex items-center gap-1 text-body text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        返回我的应用
      </Link>

      {loading ? (
        <div className="font-[weight:inherit] flex items-center gap-2 text-body text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          正在加载应用…
        </div>
      ) : null}

      {error ? (
        <div className="font-[weight:inherit] rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-body text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {app ? (
        <>
          <header className="flex items-center gap-3 border-b border-border pb-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <CapabilityAppIcon name={app.icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-heading font-bold leading-tight">{app.title}</h1>
              <p className="font-[weight:inherit] truncate text-label text-muted-foreground">
                {app.id} · v{app.version} · {app.source === 'ai' ? 'AI 生成' : '手动创建'}
              </p>
            </div>
          </header>
          <CapabilityAppRenderer app={app} />
        </>
      ) : null}
    </PageContainer>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
