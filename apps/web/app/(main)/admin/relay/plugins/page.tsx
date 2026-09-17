// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 插件管理页(2026-09-17 立,补强 59,对标竞品 /plugins)。
 * 声明式插件:零任意代码执行,内置类型 request_block(请求拦截)/
 * upstream_header_inject(上游头注入);安装默认停用,验证后手动启用。
 */
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Blocks, Loader2, RefreshCw } from 'lucide-react'

import { Button, Input } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { BackButton } from '@/components/common'
import { cn } from '@/lib/utils'

interface Plugin {
  id: string
  pluginKey: string
  name: string
  description: string | null
  pluginType: string
  config: unknown
  priority: number
  status: string
  createdAt: string
}

const TYPE_LABEL: Record<string, string> = {
  request_block: '请求拦截',
  upstream_header_inject: '上游头注入',
}

const TYPE_PLACEHOLDER: Record<string, string> = {
  request_block: '{"modelPatterns":["gpt-4"],"ipList":[],"blockMessage":"请求被拦截"}',
  upstream_header_inject: '{"headers":{"X-Custom":"value"}}',
}

const BADGE: Record<string, string> = {
  enabled: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  disabled: 'bg-muted text-muted-foreground',
}

function Badge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'rounded-md px-2 py-0.5 text-xs font-medium',
        BADGE[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {status}
    </span>
  )
}

export default function RelayPluginsPage() {
  const qc = useQueryClient()
  const [msg, setMsg] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [form, setForm] = React.useState({
    pluginKey: '',
    name: '',
    pluginType: 'request_block',
    config: '',
  })

  const q = useQuery({
    queryKey: ['admin', 'relay', 'plugins'],
    queryFn: async () => {
      const r = await fetchApi<{ list: Plugin[]; total: number }>('/api/admin/relay/plugins')
      if (!r.success) throw new Error(r.error)
      return r.data.list
    },
  })

  // 显式 post/del 两个入口:method 字面量与 path 同行,保证 check-api-routes 静态识别
  const post = async (path: string, body?: unknown) => {
    setBusy(true)
    setMsg('')
    try {
      const r = await fetchApi(path, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!r.success) throw new Error(r.error)
      setMsg('操作成功')
      void qc.invalidateQueries({ queryKey: ['admin', 'relay', 'plugins'] })
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const del = async (path: string) => {
    setBusy(true)
    setMsg('')
    try {
      // method 用小写字面量:check-api-routes 的 sameLine 正则区分大小写
      const r = await fetchApi(path, { method: 'delete' })
      if (!r.success) throw new Error(r.error)
      setMsg('操作成功')
      void qc.invalidateQueries({ queryKey: ['admin', 'relay', 'plugins'] })
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const install = () => {
    let config: unknown
    try {
      config = form.config.trim() ? JSON.parse(form.config) : {}
    } catch {
      setMsg('配置必须是合法 JSON')
      return
    }
    void post('/api/admin/relay/plugins', {
      pluginKey: form.pluginKey,
      name: form.name,
      pluginType: form.pluginType,
      config,
    })
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <BackButton />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Blocks className="h-5 w-5" aria-hidden />
            插件系统
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            声明式插件,零任意代码执行;请求拦截在计费/审计前生效(403),上游头注入作用于全部渠道直连路径。
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={cn('h-4 w-4', q.isFetching && 'animate-spin')} aria-hidden />
          <span>刷新</span>
        </Button>
      </div>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      {/* 安装表单 */}
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <p className="text-sm font-medium">安装/覆盖插件</p>
        <div className="grid gap-2 min-[640px]:grid-cols-3">
          <Input
            placeholder="插件键(小写字母/数字/_/-)"
            value={form.pluginKey}
            onChange={(e) => setForm({ ...form, pluginKey: e.target.value })}
          />
          <Input
            placeholder="名称"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={form.pluginType}
            onChange={(e) => setForm({ ...form, pluginType: e.target.value, config: '' })}
            aria-label="插件类型"
          >
            <option value="request_block">request_block(请求拦截)</option>
            <option value="upstream_header_inject">upstream_header_inject(上游头注入)</option>
          </select>
        </div>
        <textarea
          className="min-h-[72px] w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
          placeholder={`JSON 配置,如 ${TYPE_PLACEHOLDER[form.pluginType]}`}
          value={form.config}
          onChange={(e) => setForm({ ...form, config: e.target.value })}
          aria-label="插件配置 JSON"
        />
        <Button size="sm" disabled={busy || !form.pluginKey || !form.name} onClick={install}>
          <span>安装(默认停用)</span>
        </Button>
      </div>

      {/* 插件列表 */}
      {q.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          加载中...
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">暂无插件</p>
      ) : (
        <div className="space-y-3">
          {(q.data ?? []).map((p) => (
            <div key={p.id} className="rounded-lg border bg-card p-3 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{p.name}</p>
                <Badge status={p.status} />
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                  {TYPE_LABEL[p.pluginType] ?? p.pluginType}
                </span>
                <span className="text-xs text-muted-foreground">优先级 {p.priority}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {p.pluginKey}
                {p.description ? ` · ${p.description}` : ''}
              </p>
              <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 text-xs">
                {JSON.stringify(p.config, null, 2)}
              </pre>
              <div className="flex gap-2 pt-1">
                <Button
                  size="xs"
                  disabled={busy || p.status === 'enabled'}
                  onClick={() => post(`/api/admin/relay/plugins/${p.id}/enable`)}
                >
                  <span>启用</span>
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={busy || p.status === 'disabled'}
                  onClick={() => post(`/api/admin/relay/plugins/${p.id}/disable`)}
                >
                  <span>停用</span>
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={busy}
                  onClick={() => del(`/api/admin/relay/plugins/${p.id}`)}
                >
                  <span>删除</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
