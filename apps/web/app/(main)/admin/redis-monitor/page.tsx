'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Cpu, Database, HardDrive, Zap, Trash2, Server, Target, Loader2 } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { StatCard } from '@/components/data'
import { cn } from '@/lib/utils'
import type { RedisMonitorResponse } from './types'

const FB: RedisMonitorResponse = {
  overview: { totalKeys: 0, usedMemory: 0, maxMemory: 0, hitRate: 0, missRate: 0, hits: 0, misses: 0, evictions: 0, connectedClients: 0, uptime: 0, opsPerSec: 0 },
  topKeys: [], byPrefix: [],
}
const TB: Record<RedisMonitorResponse['topKeys'][number]['type'], string> = {
  string: 'bg-sky-500/10 text-sky-600', list: 'bg-emerald-500/10 text-emerald-600', hash: 'bg-amber-500/10 text-amber-600',
  set: 'bg-rose-500/10 text-rose-600', zset: 'bg-purple-500/10 text-purple-600', stream: 'bg-indigo-500/10 text-indigo-600',
}
const Empty = () => <div className="mt-3 rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">暂无数据</div>

export default function RedisMonitorPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'monitor', 'redis'],
    queryFn: async () => {
      const r = await fetchApi<RedisMonitorResponse>('/api/v1/admin/monitor/redis')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    retry: false,
  })
  const delMut = useMutation({
    mutationFn: async (key: string) => {
      const r = await fetchApi<{ ok: boolean }>(`/api/v1/admin/monitor/redis/${encodeURIComponent(key)}`, { method: 'DELETE' })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'monitor', 'redis'] }),
  })
  const nf = new Intl.NumberFormat(locale)
  const o = (data ?? FB).overview, p = (data ?? FB).byPrefix, k = (data ?? FB).topKeys
  const mp = o.maxMemory > 0 ? (o.usedMemory / o.maxMemory) * 100 : 0
  const tp = p.reduce((a, x) => a + x.count, 0) || 1
  const bc = mp > 80 ? 'bg-red-500/70' : mp > 60 ? 'bg-amber-500/70' : 'bg-emerald-500/70'
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Cpu className="h-6 w-6 text-primary" />Redis 监控
      </h1>
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard title="键" value={nf.format(o.totalKeys)} icon={Database} loading={isLoading} />
        <StatCard title="内存" value={`${nf.format(o.usedMemory)} MB`} icon={HardDrive} loading={isLoading} />
        <StatCard title="命中率" value={`${o.hitRate}%`} icon={Target} loading={isLoading} />
        <StatCard title="OPS" value={nf.format(o.opsPerSec)} icon={Zap} loading={isLoading} />
      </div>
      <section className="rounded-lg border p-4">
        <div className="flex items-center justify-between text-sm tabular-nums">
          <span className="text-muted-foreground">{nf.format(o.usedMemory)} / {nf.format(o.maxMemory)} MB · 命中 {nf.format(o.hits)}</span>
          <span className="font-semibold">{mp.toFixed(1)}%</span>
        </div>
        <div className="relative mt-2 h-3 overflow-hidden rounded bg-muted/40">
          <div className={cn('h-full rounded-md', bc)} style={{ width: `${Math.min(100, mp)}%` }} />
        </div>
      </section>
      <section className="rounded-lg border p-4">
        <h2 className="text-base font-semibold">按前缀分布</h2>
        {p.length === 0 ? <Empty /> : (
          <div className="mt-3 space-y-2">
            {p.map((x) => (<div key={x.prefix}>
              <div className="flex items-center justify-between text-sm tabular-nums">
                <span className="font-mono text-muted-foreground">{x.prefix}</span>
                <span>{nf.format(x.count)} 键 · {nf.format(x.size)} KB</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded bg-muted/40">
                <div className="h-full rounded-md bg-primary/70" style={{ width: `${(x.count / tp) * 100}%` }} />
              </div>
            </div>))}
          </div>
        )}
      </section>
      <section className="rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Server className="h-4 w-4 text-primary" />热点键</h2>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {k.length === 0 ? <Empty /> : (
          <table className="mt-3 w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">键</th><th className="px-3 py-2 font-medium">类型</th>
              <th className="px-3 py-2 font-medium text-right">大小</th><th className="px-3 py-2 font-medium text-right">TTL</th>
              <th className="px-3 py-2 font-medium text-right">命中</th><th className="px-3 py-2 font-medium text-right">操作</th>
            </tr></thead>
            <tbody>{k.map((it) => (<tr key={it.key} className="border-b border-border last:border-0">
              <td className="px-3 py-2 font-mono text-xs">{it.key}</td>
              <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs ${TB[it.type]}`}>{it.type}</span></td>
              <td className="px-3 py-2 text-right tabular-nums">{nf.format(it.size)} B</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{it.ttl}</td>
              <td className="px-3 py-2 text-right tabular-nums">{nf.format(it.hits)}</td>
              <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" disabled={delMut.isPending} onClick={() => delMut.mutate(it.key)}><Trash2 className="h-4 w-4" /></Button></td>
            </tr>))}</tbody>
          </table>
        )}
      </section>
    </div>
  )
}
