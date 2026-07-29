'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Key, Plus, Trash2, RotateCcw, Copy, Eye, EyeOff, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface RelayKey {
  id: string
  name: string
  key: string
  permissions: string[]
  status: string
  rateLimit: number
  tokenBalance: number
  costBalanceCents: number
  tokenUsedTotal: number
  costUsedTotalCents: number
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}

interface KeysData {
  list: RelayKey[]
}

const SCOPES = ['read', 'write', 'admin', 'billing', 'webhook']

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function maskKey(k: string): string {
  if (k.length <= 8) return k
  return k.slice(0, 4) + '****' + k.slice(-4)
}

function formatToken(n: number): { text: string; danger: boolean } {
  if (n === -1) return { text: '无限额度', danger: false }
  if (n === 0) return { text: '已耗尽', danger: true }
  return { text: n.toLocaleString(), danger: false }
}

function formatBalance(cents: number): { text: string; danger: boolean } {
  if (cents === -1) return { text: '无限额度', danger: false }
  if (cents === 0) return { text: '已耗尽', danger: true }
  return { text: (cents / 100).toFixed(2) + ' 元', danger: false }
}

export default function RelayKeysPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [scopes, setScopes] = React.useState<string[]>(['read'])
  const [visible, setVisible] = React.useState<Record<string, boolean>>({})
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })

  const { data, isLoading, error } = useQuery({
    queryKey: ['developer', 'relay', 'keys'],
    queryFn: () =>
      api<KeysData>('/api/developer/relay/keys').catch(() => ({ list: [] }) as KeysData),
  })
  const list = data?.list ?? []

  const createMut = useMutation({
    mutationFn: () =>
      api('/api/developer/keys', {
        method: 'POST',
        body: JSON.stringify({ name, scopes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'relay', 'keys'] })
      setOpen(false)
      setName('')
      setScopes(['read'])
      toast.success('Key 已创建')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/developer/keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'relay', 'keys'] })
      toast.success('Key 已吊销')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const resetMut = useMutation({
    mutationFn: (id: string) => api(`/api/developer/keys/${id}/reset`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'relay', 'keys'] })
      toast.success('Key 已重置')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function copyKey(k: string) {
    navigator.clipboard
      ?.writeText(k)
      .then(() => toast.success('已复制'), () => toast.error('复制失败'))
  }
  function toggleScope(s: string) {
    setScopes((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Key className="h-6 w-6 text-primary" />
            API Key 管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">创建、吊销与重置中转站 API Key</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          新建 Key
        </Button>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">暂无数据</p>
        ) : (
          <div className="space-y-2 p-3">
            {list.map((k) => {
              const tok = formatToken(k.tokenBalance)
              const bal = formatBalance(k.costBalanceCents)
              return (
                <div key={k.id} className="rounded-md bg-muted/40 p-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{k.name}</p>
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-xs font-medium',
                            k.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                          )}
                        >
                          {k.status === 'active' ? '启用' : '已吊销'}
                        </span>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {k.rateLimit}/min
                        </span>
                        {k.permissions.map((p) => (
                          <span
                            key={p}
                            className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="text-xs text-muted-foreground">
                          {visible[k.id] ? k.key : maskKey(k.key)}
                        </code>
                        <button
                          onClick={() => setVisible((v) => ({ ...v, [k.id]: !v[k.id] }))}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="切换显示"
                        >
                          {visible[k.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={() => copyKey(k.key)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="复制"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        <span>
                          Token 余额:
                          <span
                            className={cn(
                              'ml-0.5 font-medium',
                              tok.danger
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-foreground',
                            )}
                          >
                            {tok.text}
                          </span>
                        </span>
                        <span>
                          成本余额:
                          <span
                            className={cn(
                              'ml-0.5 font-medium',
                              bal.danger
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-foreground',
                            )}
                          >
                            {bal.text}
                          </span>
                        </span>
                        <span>
                          已用 Token:
                          <span className="ml-0.5 font-medium text-foreground">
                            {k.tokenUsedTotal.toLocaleString()}
                          </span>
                        </span>
                        <span>
                          已用成本:
                          <span className="ml-0.5 font-medium text-foreground">
                            {(k.costUsedTotalCents / 100).toFixed(2)} 元
                          </span>
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        创建 {dateFmt.format(new Date(k.createdAt))}
                        {k.lastUsedAt && ` · 最近使用 ${dateFmt.format(new Date(k.lastUsedAt))}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resetMut.mutate(k.id)}
                        disabled={resetMut.isPending}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        重置
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          confirm('确认吊销该 Key?此操作不可撤销') && delMut.mutate(k.id)
                        }
                        disabled={delMut.isPending}
                        className="text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        吊销
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建 API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-sm">Key 名称</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如:生产环境 Key"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">权限范围</Label>
              <div className="flex flex-wrap gap-2">
                {SCOPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleScope(s)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs transition-colors',
                      scopes.includes(s)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={() => createMut.mutate()} disabled={!name.trim() || createMut.isPending}>
              {createMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
