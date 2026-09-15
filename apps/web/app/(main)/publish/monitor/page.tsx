// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 发布监测页:拉取 /api/publish/monitor/overview,汇总成功/失败/核验未过,
 * 逐篇渲染 MonitorCard(发布状态 / 样式核验 / 修复重提 / 互动数据四块)。
 * 复用 history/page.tsx 的数据获取(fetchApi)、@ihui/ui-react 组件与 next-intl 用法。
 *
 * AGENTS.md §4:< 200 行 / rounded-md / 无分割线 / 无渐变遮罩
 */
import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { RefreshCw, BarChart3, Loader2, Plus } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { BackButton } from '@/components/common'
import { Button, StatCard, StatGrid } from '@ihui/ui-react'
import { MonitorCard, type MonitorItem } from './MonitorCard'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function MonitorPage() {
  const t = useTranslations('publishMonitor')
  const toast = useToast()
  const [items, setItems] = React.useState<MonitorItem[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<{ items?: MonitorItem[] }>('/api/publish/monitor/overview?limit=20')
      setItems(data.items ?? [])
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    void load()
  }, [load])

  const success = items.filter((i) => i.status === 'success').length
  const failed = items.filter((i) => i.status === 'failed').length
  const unverified = items.filter((i) => i.style_check && !i.style_check.passed).length

  return (
    <div className="px-4 space-y-4">
      <BackButton />
      <div className="flex items-center justify-between gap-3">
        <StatGrid cols={3} className="flex-1">
          <StatCard label={t('summarySuccess')} value={success} variant="success" />
          <StatCard label={t('summaryFailed')} value={failed} variant="danger" />
          <StatCard label={t('summaryUnverified')} value={unverified} variant="warning" />
        </StatGrid>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {loading ? t('refreshing') : t('refresh')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1 text-center">
            <p className="text-sm font-medium">{t('emptyTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('emptyHint')}</p>
          </div>
          <Link href="/publish/new">
            <Button size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5" />
              {t('goCreate')}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <MonitorCard key={item.task_id} item={item} onChanged={() => void load()} />
          ))}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‌‍
