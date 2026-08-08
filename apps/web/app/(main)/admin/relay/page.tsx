'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import {
  Server,
  Package,
  KeyRound,
  Activity,
  Coins,
  ArrowRight,
  Pencil,
  Percent,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import { Skeleton } from '@/components/ui/skeleton'
import { BackButton } from '@/components/common'

interface ProviderDist {
  providerCode: string
  count: number
}

interface RelayStats {
  totalModels: number
  publicModels: number
  privateModels: number
  providerDistribution: ProviderDist[]
  last30dCalls: number
  last30dTokens: number
}

interface CommissionProvider {
  providerCode: string
  byokCommissionRate: number
  isEnabled: boolean
}

const STATS = [
  { key: 'totalModels' as const, label: '模型总数', icon: Package, color: 'text-primary' },
  {
    key: 'publicModels' as const,
    label: '已上架',
    icon: Server,
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  { key: 'privateModels' as const, label: '未上架', icon: Server, color: 'text-muted-foreground' },
  {
    key: 'last30dCalls' as const,
    label: '近 30 天调用',
    icon: Activity,
    color: 'text-amber-600 dark:text-amber-400',
  },
]

export default function AdminRelayOverviewPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'relay', 'stats'],
    queryFn: async () => {
      const r = await fetchApi<RelayStats>('/api/admin/relay/models/stats')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  // ===== BYOK 抽成配置 =====
  const [editTarget, setEditTarget] = React.useState<CommissionProvider | null>(null)
  const [rateInput, setRateInput] = React.useState<string>('10')
  const commissionQ = useQuery({
    queryKey: ['admin', 'relay', 'commission'],
    queryFn: async () => {
      const r = await fetchApi<{ providers: CommissionProvider[] }>('/api/admin/relay/commission')
      if (!r.success) throw new Error(r.error)
      return r.data.providers
    },
  })
  const updateCommission = useMutation({
    mutationFn: async (vars: {
      providerCode: string
      rate: number
    }): Promise<{
      data: { providerCode: string; byokCommissionRate: number }
      status: number
    }> => {
      // fetchApi 的 ApiResult success 分支不携带 HTTP status,本场景需区分
      // 200(更新已有全局行)/ 201(新建全局配置行),改用原生 fetch 直读 response.status
      const baseUrl =
        typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
          ? 'http://127.0.0.1:8802'
          : process.env.NEXT_PUBLIC_API_BASE_URL || ''
      // P2-18 修复(2026-08-06):auth_token 已 httpOnly,getAuthCookie() 恒返回 null,
      // 不再用它拼 Bearer;改用内存 token(有则发)+ credentials: include(cookie 自动附带兜底),
      // 并带 X-Requested-With 满足后端 cookie 认证路径的 CSRF 校验。
      const token = useAuthStore.getState().token
      const res = await fetch(
        `${baseUrl}/api/admin/relay/commission/${encodeURIComponent(vars.providerCode)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ byokCommissionRate: vars.rate }),
        },
      )
      const body = (await res.json().catch(() => null)) as {
        data?: { providerCode?: string; byokCommissionRate?: number }
        message?: string
      } | null
      if (!res.ok) {
        throw new Error(body?.message || `HTTP ${res.status}`)
      }
      const data = body?.data
      if (
        !data ||
        typeof data.providerCode !== 'string' ||
        typeof data.byokCommissionRate !== 'number'
      ) {
        throw new Error('响应数据格式错误')
      }
      return {
        data: {
          providerCode: data.providerCode,
          byokCommissionRate: data.byokCommissionRate,
        },
        status: res.status,
      }
    },
    onSuccess: (result) => {
      if (result.status === 201) {
        toast.success(`已为新 provider 创建默认抽成配置 (${result.data.providerCode})`)
      } else {
        toast.success(`抽成率已更新 (${result.data.providerCode})`)
      }
      setEditTarget(null)
      qc.invalidateQueries({ queryKey: ['admin', 'relay', 'commission'] })
    },
    onError: (e: Error) => toast.error(e.message || '更新失败'),
  })

  const openCommissionEdit = (p: CommissionProvider) => {
    setEditTarget(p)
    setRateInput(String(Math.round(p.byokCommissionRate * 1000) / 10))
  }
  const submitCommissionEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    const pct = Number(rateInput)
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast.error('抽成率必须在 0~100 之间')
      return
    }
    updateCommission.mutate({ providerCode: editTarget.providerCode, rate: pct / 100 })
  }

  const numFmt = new Intl.NumberFormat(locale)
  const stats = data ?? {
    totalModels: 0,
    publicModels: 0,
    privateModels: 0,
    providerDistribution: [],
    last30dCalls: 0,
    last30dTokens: 0,
  }
  const maxProviderCount = Math.max(1, ...stats.providerDistribution.map((p) => p.count))
  const commissionList = commissionQ.data ?? []

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Server className="h-6 w-6 text-primary" />
          模型中转站
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          统一管理上游厂商模型上架、Key 池调度、动态发现审批与调用日志
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
        {STATS.map((s) => (
          <Card key={s.key}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                <span className="min-w-0 truncate">{s.label}</span>
                <s.icon className={`h-4 w-4 shrink-0 ${s.color}`} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <div className={`text-2xl font-bold tabular-nums ${s.color}`}>
                  {numFmt.format(stats[s.key])}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 min-[1024px]:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Coins className="h-4 w-4 text-amber-600" />近 30 天 Token 用量
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <div className="text-2xl font-bold tabular-nums">
                {numFmt.format(stats.last30dTokens)}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">累计 prompt + completion tokens</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">厂商分布(已上架)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton variant="list" rows={3} />
            ) : stats.providerDistribution.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">暂无数据</p>
            ) : (
              stats.providerDistribution.map((p) => (
                <div key={p.providerCode} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">
                    {p.providerCode}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-sm bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(p.count / maxProviderCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums">{p.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Percent className="h-4 w-4 text-primary" />
            BYOK 平台抽成配置
          </CardTitle>
          <CardDescription className="text-xs">
            用户自带 Key 调用时平台收取的服务费比例(免费 provider 不收费)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {commissionQ.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : commissionList.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">暂无全局 provider 配置</p>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Provider</th>
                      <th className="px-3 py-2 text-right">抽成率</th>
                      <th className="px-3 py-2 text-left">状态</th>
                      <th className="px-3 py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionList.map((p) => (
                      <tr key={p.providerCode}>
                        <td className="px-3 py-2 font-mono text-xs">{p.providerCode}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {(p.byokCommissionRate * 100).toFixed(1)}%
                        </td>
                        <td className="px-3 py-2">
                          {p.isEnabled ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              启用
                            </Badge>
                          ) : (
                            <Badge variant="secondary">禁用</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => openCommissionEdit(p)}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            编辑
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
        {[
          {
            href: '/admin/relay/models',
            label: '模型管理',
            desc: '上下架 / 定价 / 排序',
            icon: Package,
          },
          {
            href: '/admin/relay/key-pool',
            label: 'Key 池',
            desc: '调度 / 健康检查',
            icon: KeyRound,
          },
          {
            href: '/admin/relay/discovery',
            label: '动态发现',
            desc: '上游模型审批',
            icon: Activity,
          },
          {
            href: '/admin/relay/logs',
            label: '调用日志',
            desc: '请求 / Token / 错误',
            icon: Coins,
          },
        ].map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="group flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <entry.icon className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-medium">{entry.label}</div>
                <div className="text-xs text-muted-foreground">{entry.desc}</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      <Dialog open={editTarget !== null} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑 BYOK 抽成率</DialogTitle>
            <DialogDescription>
              {editTarget
                ? `设置 ${editTarget.providerCode} 的平台服务费抽成比例`
                : '设置 provider 的平台服务费抽成比例'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCommissionEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="commission-rate" className="text-xs">
                抽成率(%)
              </Label>
              <Input
                id="commission-rate"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                max={100}
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                范围 0~100,支持 1 位小数(如 10.5 表示 10.5%)
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditTarget(null)}
                disabled={updateCommission.isPending}
              >
                取消
              </Button>
              <Button type="submit" size="sm" disabled={updateCommission.isPending}>
                {updateCommission.isPending ? '保存中…' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
