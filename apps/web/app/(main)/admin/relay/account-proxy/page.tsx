// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 账号代理管理页(2026-10-27 立)。
 *
 * 账号级 proxyUrl 只对该账号生效、不进共享代理池;落库是密文,后端只回脱敏值
 * (`proxyUrlMasked`),本页全程不回显明文 —— 编辑框按密码型,仅管理员本次输入时
 * 可临时切到可见。保存/清除都走 `PUT /admin/relay/accounts/:id`,只提交 proxyUrl
 * 一个字段,不连带覆盖名称/权重等其他字段。
 */

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { fetchApi } from '@/lib/api'
import {
  Button,
  ChevronLeft,
  ChevronRight,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Eye,
  EyeOff,
  Input,
  Label,
  Loader2,
  RefreshCw,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ShieldCheck,
} from '@ihui/ui-react'
import { Skeleton } from '@/components/ui/skeleton'
import { BackButton } from '@/components/common'
import { useConfirm } from '@/hooks/use-confirm'

const PAGE_SIZE = 20
const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const PROVIDER_OPTIONS = ['trae', 'workbuddy', 'codearts', 'qoder'] as const
// 与后端 updateBodySchema 同口径:只接受 http(s)/socks5
const PROXY_PROTOCOLS = new Set(['http:', 'https:', 'socks5:'])

function isSupportedProxyUrl(raw: string): boolean {
  try {
    return PROXY_PROTOCOLS.has(new URL(raw).protocol)
  } catch {
    return false
  }
}

interface AccountProxyRow {
  id: string
  providerCode: string
  uid: string | null
  name: string
  isEnabled: boolean
  healthStatus: string
  hasProxy: boolean
  /** back-end 脱敏投影:scheme://***@host;明文账密/路径/查询串不返回 */
  proxyUrlMasked: string | null
  lastUsedAt: string | null
}
interface ListData {
  list: AccountProxyRow[]
  total: number
  page: number
  pageSize: number
}

const HEALTH_CLASS: Record<string, string> = {
  unknown: 'bg-muted text-muted-foreground',
  healthy: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  degraded: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  down: 'bg-red-500/10 text-red-600 dark:text-red-400',
}
const HEALTH_LABEL: Record<string, string> = {
  unknown: '未知',
  healthy: '健康',
  degraded: '降级',
  down: '异常',
}

export default function AccountProxyPage() {
  const qc = useQueryClient()
  const locale = useLocale()
  const { confirm, ConfirmDialogRenderer } = useConfirm()

  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [provider, setProvider] = React.useState('')
  const [proxyState, setProxyState] = React.useState<'all' | 'private' | 'direct'>('all')
  const [editing, setEditing] = React.useState<AccountProxyRow | null>(null)
  const [draft, setDraft] = React.useState('')
  const [visible, setVisible] = React.useState(false)

  const qs = React.useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (search.trim()) p.set('search', search.trim())
    if (provider) p.set('provider', provider)
    if (proxyState !== 'all') p.set('hasProxy', proxyState === 'private' ? 'true' : 'false')
    return p.toString()
  }, [page, search, provider, proxyState])

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'relay', 'account-proxy', qs],
    queryFn: async () => {
      const r = await fetchApi<ListData>(`/api/admin/relay/accounts?${qs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })

  const invalidate = React.useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['admin', 'relay', 'account-proxy'] })
    // 账号池页消费同一份账号数据,保存后一并失效,避免两页视图不一致
    void qc.invalidateQueries({ queryKey: ['admin', 'relay', 'account-pool'] })
  }, [qc])

  const saveMut = useMutation({
    mutationFn: async (vars: { id: string; proxyUrl: string | null }) => {
      const r = await fetchApi<{ id: string }>(`/api/admin/relay/accounts/${vars.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxyUrl: vars.proxyUrl }),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.proxyUrl ? '代理已保存' : '已清除代理,回落到共享代理池/直连')
      setEditing(null)
      setDraft('')
      setVisible(false)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '保存失败'),
  })

  const openEditor = (row: AccountProxyRow) => {
    setEditing(row)
    setDraft('')
    setVisible(false)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    const v = draft.trim()
    if (!v) {
      toast.error('请输入代理地址')
      return
    }
    if (!isSupportedProxyUrl(v)) {
      toast.error('代理地址必须是 http(s)/socks5 协议')
      return
    }
    saveMut.mutate({ id: editing.id, proxyUrl: v })
  }

  const clearProxy = (row: AccountProxyRow) => {
    void confirm({
      title: `清除「${row.name}」的代理?`,
      description: '清除后该账号回落到共享代理池;池内无可用代理时按直连。',
      confirmText: '清除',
      variant: 'destructive',
    }).then((ok) => {
      if (ok) saveMut.mutate({ id: row.id, proxyUrl: null })
    })
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ShieldCheck className="h-6 w-6 text-primary" />
            账号代理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            给单个账号绑定专属代理,固定它的出口 IP;仅对该账号生效,不进入共享代理池
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span>
          生效顺序：账号代理 &gt; 共享代理池 &gt;
          直连。保存后聊天、换票、巡检都会立即走该代理；地址按密文落库，页面只展示脱敏值。
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
          placeholder="搜索 name / uid"
          wrapperClassName="max-w-xs flex-1"
        />
        <Select
          value={provider || 'all'}
          onValueChange={(v) => {
            setPage(1)
            setProvider(v === 'all' ? '' : v)
          }}
        >
          <SelectTrigger className={selectClass} aria-label="平台">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部平台</SelectItem>
            {PROVIDER_OPTIONS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={proxyState}
          onValueChange={(v) => {
            setPage(1)
            setProxyState(v as typeof proxyState)
          }}
        >
          <SelectTrigger className={selectClass} aria-label="代理状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部账号</SelectItem>
            <SelectItem value="private">已配置代理</SelectItem>
            <SelectItem value="direct">直连</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground [&>tr>th]:whitespace-nowrap">
              <tr>
                <th className="px-3 py-2 text-left">账号</th>
                <th className="px-3 py-2 text-left">平台</th>
                <th className="px-3 py-2 text-left">状态</th>
                <th className="px-3 py-2 text-left">健康</th>
                <th className="px-3 py-2 text-left">代理地址</th>
                <th className="px-3 py-2 text-left">最近使用</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    <td colSpan={7} className="px-3 py-2">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-red-500">
                    加载失败:{error instanceof Error ? error.message : '未知错误'}
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    暂无匹配账号
                  </td>
                </tr>
              ) : (
                list.map((k) => (
                  <tr key={k.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{k.name}</div>
                      {k.uid ? (
                        <div
                          className="max-w-[14rem] truncate font-mono text-xs text-muted-foreground"
                          title={k.uid}
                        >
                          {k.uid}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs">{k.providerCode}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          k.isEnabled
                            ? 'rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400'
                            : 'rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground'
                        }
                      >
                        {k.isEnabled ? '启用' : '停用'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs ${
                          HEALTH_CLASS[k.healthStatus] ?? HEALTH_CLASS.unknown
                        }`}
                      >
                        {HEALTH_LABEL[k.healthStatus] ?? k.healthStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {k.hasProxy ? (
                        <code
                          className="inline-block max-w-[16rem] truncate rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs"
                          title={k.proxyUrlMasked ?? '已配置（脱敏）'}
                        >
                          {k.proxyUrlMasked ?? '已配置（脱敏）'}
                        </code>
                      ) : (
                        <span className="text-xs text-muted-foreground">直连</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {k.lastUsedAt ? fmt.format(new Date(k.lastUsedAt)) : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEditor(k)}>
                          {k.hasProxy ? '更换' : '设置代理'}
                        </Button>
                        {k.hasProxy ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            disabled={saveMut.isPending}
                            onClick={() => clearProxy(k)}
                          >
                            清除
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 个账号</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {editing?.hasProxy ? '更换代理' : '设置代理'}
                {editing ? `:${editing.name}` : ''}
              </DialogTitle>
            </DialogHeader>

            {editing?.hasProxy ? (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">当前代理（脱敏）</Label>
                <code className="block truncate rounded-md border border-border bg-muted/30 px-2 py-1.5 font-mono text-xs">
                  {editing.proxyUrlMasked ?? '已配置（脱敏）'}
                </code>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="ap-proxy">代理地址</Label>
              <div className="relative">
                <Input
                  id="ap-proxy"
                  type={visible ? 'text' : 'password'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="http://user:pass@host:port 或 socks5://host:port"
                  autoComplete="off"
                  spellCheck={false}
                  className="pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setVisible((v) => !v)}
                  aria-label={visible ? '隐藏代理地址' : '显示代理地址'}
                >
                  {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                支持 http(s):// 与
                socks5://。保存后立即用于该账号的转发、换票与巡检，其他账号不受影响。
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                取消
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialogRenderer />
    </div>
  )
}
