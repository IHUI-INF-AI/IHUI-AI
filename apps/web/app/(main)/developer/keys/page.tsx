'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Key, Plus, Trash2, Copy, RefreshCw, Loader2, Eye, EyeOff } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button, Input, Label } from '@ihui/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface ApiKey {
  id: string
  name: string
  key: string
  scopes: string[]
  createdAt: string
  lastUsedAt?: string
}

const ALL_SCOPES = ['read', 'write', 'admin', 'billing', 'webhook']

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function KeysPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [scopes, setScopes] = React.useState<string[]>(['read'])
  const [visible, setVisible] = React.useState<Record<string, boolean>>({})

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const {
    data: list = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['developer', 'keys'],
    queryFn: () => api<ApiKey[]>('/api/developer/keys').catch(() => [] as ApiKey[]),
  })

  const createMut = useMutation({
    mutationFn: () =>
      api('/api/developer/keys', {
        method: 'POST',
        body: JSON.stringify({ name, scopes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'keys'] })
      setOpen(false)
      setName('')
      setScopes(['read'])
      toast.success('密钥已创建')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/developer/keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'keys'] })
      toast.success('密钥已删除')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const resetMut = useMutation({
    mutationFn: (id: string) => api(`/api/developer/keys/${id}/reset`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'keys'] })
      toast.success('密钥已重置')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function copyKey(k: string) {
    navigator.clipboard?.writeText(k).then(
      () => toast.success('已复制'),
      () => toast.error('复制失败'),
    )
  }

  function toggleScope(s: string) {
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  function maskKey(k: string) {
    if (k.length <= 8) return k
    return k.slice(0, 4) + '****' + k.slice(-4)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Key className="h-5 w-5 text-primary" />
            密钥管理
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">创建与维护 API 密钥及权限范围</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          新建密钥
        </Button>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无 API 密钥</p>
          ) : (
            <div className="divide-y">
              {list.map((k) => (
                <div key={k.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{k.name}</p>
                      <div className="flex gap-1">
                        {k.scopes.map((s) => (
                          <span
                            key={s}
                            className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <code className="text-xs text-muted-foreground">
                        {visible[k.id] ? k.key : maskKey(k.key)}
                      </code>
                      <button
                        onClick={() => setVisible((v) => ({ ...v, [k.id]: !v[k.id] }))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {visible[k.id] ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        onClick={() => copyKey(k.key)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      创建于 {dateFmt.format(new Date(k.createdAt))}
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
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => confirm('确认删除该密钥?') && delMut.mutate(k.id)}
                      disabled={delMut.isPending}
                      className="text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建 API 密钥</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-sm">密钥名称</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如:生产环境密钥"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">权限范围</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_SCOPES.map((s) => (
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
            <Button
              onClick={() => createMut.mutate()}
              disabled={!name.trim() || createMut.isPending}
            >
              {createMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
