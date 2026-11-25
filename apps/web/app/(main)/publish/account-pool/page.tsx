// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 发布账号池(2026-11-25)。
 *
 * 一个入口回答三件事:
 *   1. 每个平台有几个号、几个活着(不是"cookie 名还在"的假活);
 *   2. 下一轮体检什么时候跑、上次为什么失败;
 *   3. 掉了的号在这里一键重扫,扫完自动回池。
 *
 * 数据源: GET /api/publish/pools(+ /{id} 取成员)。取号在发布任务里自动发生,
 * 本页只做管理,不代替发布。
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Plus,
  Loader2,
  Activity,
  Clock3,
  QrCode,
  type LucideIcon,
} from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
} from '@ihui/ui-react'
import {
  listPublishPools,
  bootstrapPublishPools,
  getPublishPool,
  probePublishPool,
  probePublishAccount,
  getPublishKeeperStatus,
  type PublishPool,
  type PublishPoolMember,
} from '@ihui/api-client'
import { PlatformIcon } from '@/components/publish/platform-icon'
import { BackButton } from '@/components/common'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ScanLoginDialog } from '../accounts/ScanLoginDialog'

type KeeperStatus = {
  enabled: boolean
  active: boolean
  tickSeconds: number
  intervalMinutes: number
  concurrency: number
  timeoutSeconds: number
  lastTickAt: string | null
  lastError: string | null
}

const POOL_STATUS: Record<string, { label: string; className: string; icon: LucideIcon }> = {
  healthy: { label: '健康', className: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: ShieldCheck },
  degraded: { label: '需补号', className: 'text-amber-600 bg-amber-50 border-amber-200', icon: ShieldAlert },
  empty: { label: '空池', className: 'text-muted-foreground bg-muted border-border', icon: ShieldX },
  pending: { label: '待体检', className: 'text-sky-600 bg-sky-50 border-sky-200', icon: Clock3 },
  paused: { label: '已暂停', className: 'text-muted-foreground bg-muted border-border', icon: ShieldX },
  active: { label: '运行中', className: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: ShieldCheck },
}

const SESSION_STATUS: Record<string, { label: string; className: string }> = {
  healthy: { label: '在线', className: 'text-emerald-600 bg-emerald-50' },
  unknown: { label: '待体检', className: 'text-muted-foreground bg-muted' },
  degraded: { label: '异常', className: 'text-amber-600 bg-amber-50' },
  expiring: { label: '临期', className: 'text-amber-600 bg-amber-50' },
  reauth_required: { label: '需重登', className: 'text-rose-600 bg-rose-50' },
}

function fmt(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { hour12: false })
}

function relative(value?: string | null): string {
  if (!value) return '—'
  const diff = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diff)) return '—'
  const min = Math.round(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.round(h / 24)} 天前`
}

function poolName(platform: string): string {
  const map: Record<string, string> = {
    wechat: '微信公众号', douyin: '抖音', kuaishou: '快手', xiaohongshu: '小红书',
    weibo: '微博', csdn: 'CSDN', juejin: '掘金', shipinhao: '视频号', zhihu: '知乎',
    bilibili: '哔哩哔哩', toutiao: '今日头条', baijiahao: '百家号', qq: '企鹅号',
    netease: '网易号', cnblogs: '博客园', jianshu: '简书', oschina: '开源中国',
    wordpress: 'WordPress', medium: 'Medium', youtube: 'YouTube',
  }
  return map[platform] ?? platform
}

export default function AccountPoolPage() {
  const router = useRouter()
  const toast = useToast()
  const [pools, setPools] = React.useState<PublishPool[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState<Record<string, PublishPool | null>>({})
  const [keeper, setKeeper] = React.useState<KeeperStatus | null>(null)
  const [reauth, setReauth] = React.useState<{ platform: string; accountId: number; name: string } | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const r = await listPublishPools()
      if (!r.success) throw new Error(r.error || '账号池加载失败')
      setPools(r.data?.items ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '账号池加载失败')
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    void load()
    void getPublishKeeperStatus().then((r) => {
      if (r.success) setKeeper(r.data ?? null)
    })
  }, [load])

  async function bootstrap() {
    setBusy('bootstrap')
    try {
      const r = await bootstrapPublishPools()
      if (!r.success) throw new Error(r.error || '建池失败')
      setPools(r.data?.items ?? [])
      toast.success('已按平台建池:所有启用账号自动入池')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '建池失败')
    } finally {
      setBusy(null)
    }
  }

  async function togglePool(pool: PublishPool) {
    if (expanded[pool.poolId]) {
      setExpanded((prev) => ({ ...prev, [pool.poolId]: null }))
      return
    }
    try {
      const r = await getPublishPool(pool.poolId)
      if (!r.success) throw new Error(r.error || '加载失败')
      setExpanded((prev) => ({ ...prev, [pool.poolId]: r.data ?? null }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载失败')
    }
  }

  async function probeAll(pool: PublishPool) {
    setBusy(`probe:${pool.poolId}`)
    try {
      const r = await probePublishPool(pool.poolId)
      if (!r.success) throw new Error(r.error || '体检失败')
      const items = r.data?.items ?? []
      const ok = items.filter((i) => i.ok).length
      toast.success(`${poolName(pool.platform)} 体检完成:${ok}/${items.length} 在线`)
      await load()
      if (expanded[pool.poolId]) {
        const d = await getPublishPool(pool.poolId)
        if (d.success) setExpanded((prev) => ({ ...prev, [pool.poolId]: d.data ?? null }))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '体检失败')
    } finally {
      setBusy(null)
    }
  }

  async function probeOne(member: PublishPoolMember) {
    setBusy(`probe:${member.accountId}`)
    try {
      const r = await probePublishAccount(member.accountId)
      if (!r.success) throw new Error(r.error || '体检失败')
      const data = r.data
      if (data?.ok) toast.success(`${member.displayName}:在线`)
      else toast.error(`${member.displayName}:${data?.message || '失效'}`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '体检失败')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">发布账号池</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              一个平台多个号统一管理:自动取号、真实登录态体检、掉线一键重扫、扫完回池。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs',
              keeper?.active
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700',
            )}
          >
            <Activity className="h-3.5 w-3.5" />
            保活引擎 {keeper?.active ? '运行中' : '未启动'}
            {keeper?.active && keeper?.lastTickAt ? ` · 上轮 ${relative(keeper.lastTickAt)}` : ''}
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('mr-1.5 h-4 w-4', loading && 'animate-spin')} />
            刷新
          </Button>
          <Button size="sm" onClick={() => void bootstrap()} disabled={busy === 'bootstrap'}>
            {busy === 'bootstrap' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            一键建池
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> 正在加载账号池…
          </CardContent>
        </Card>
      ) : pools.length === 0 ? (
        <Card>
          <CardContent className="space-y-4 py-14 text-center">
            <div className="text-sm text-muted-foreground">
              还没有账号池。点「一键建池」会按平台把现有启用账号收进去;之后发布任务不指定账号时,系统就从这个池里取号。
            </div>
            <Button onClick={() => void bootstrap()} disabled={busy === 'bootstrap'}>
              一键建池
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pools.map((pool) => {
            const meta = POOL_STATUS[pool.status] ?? POOL_STATUS.empty!
            const Icon = meta.icon
            const detail = expanded[pool.poolId]
            return (
              <Card key={pool.poolId} className="overflow-hidden">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <PlatformIcon platform={pool.platform} className="h-9 w-9 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-base font-semibold">{poolName(pool.platform)}</span>
                          <span className="text-xs text-muted-foreground">{pool.name}</span>
                          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]', meta.className)}>
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>在线 {pool.healthy}/{pool.total}</span>
                          <span>需重登 {pool.reauthRequired}</span>
                          <span>体检间隔 {pool.probeIntervalMinutes} 分钟</span>
                          <span>取号策略 {pool.strategy === 'least_recent' ? '最久未用' : pool.strategy === 'priority' ? '优先级' : '轮询'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => void togglePool(pool)}>
                        {detail ? '收起成员' : '查看成员'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void probeAll(pool)}
                        disabled={busy === `probe:${pool.poolId}` || pool.total === 0}
                      >
                        {busy === `probe:${pool.poolId}` ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1.5 h-4 w-4" />}
                        立即体检
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/publish/accounts')}
                      >
                        管理账号
                      </Button>
                    </div>
                  </div>

                  {detail?.members?.length ? (
                    <div className="divide-y rounded-lg border">
                      {(detail.members ?? []).map((member) => {
                        const s = SESSION_STATUS[member.session.status] ?? SESSION_STATUS.unknown!
                        return (
                          <div key={member.accountId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-sm font-medium">{member.displayName}</span>
                                <span className={cn('rounded-full px-2 py-0.5 text-[11px]', s.className)}>{s.label}</span>
                                {member.accountStatus !== 'active' ? (
                                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">账号已停用</span>
                                ) : null}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                                <span>上次在线 {relative(member.session.lastOkAt)}</span>
                                <span className="inline-flex items-center gap-1">
                                  <Clock3 className="h-3 w-3" /> 下次体检 {fmt(member.session.nextProbeAt)}
                                </span>
                                <span>连续失败 {member.session.consecutiveFailures}</span>
                                {member.session.lastError ? (
                                  <span className="max-w-[420px] truncate text-rose-600" title={member.session.lastError}>
                                    {member.session.lastError}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void probeOne(member)}
                                disabled={busy === `probe:${member.accountId}`}
                              >
                                {busy === `probe:${member.accountId}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                                体检
                              </Button>
                              <Button
                                size="sm"
                                variant={member.session.status === 'reauth_required' ? 'default' : 'outline'}
                                onClick={() => setReauth({ platform: member.platform, accountId: member.accountId, name: member.displayName })}
                              >
                                <QrCode className="mr-1 h-3.5 w-3.5" />
                                {member.session.status === 'reauth_required' ? '重新登录' : '重扫'}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : detail ? (
                    <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                      这个池还没有成员。
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card>
        <CardContent className="grid gap-3 p-4 text-xs text-muted-foreground md:grid-cols-3">
          <div>
            <div className="font-medium text-foreground">怎么取号</div>
            发布任务只写平台、不写账号时,按「优先级 → 会话健康 → 最久未用」自动取号;池里全失效会直接 409,不会硬发。
          </div>
          <div>
            <div className="font-medium text-foreground">怎么算活着</div>
            用平台 adapter 的 verify_credentials 去创作者后台/鉴权接口,跳登录页或 401 才算失效 —— 不看"cookie 名还在不在"。
          </div>
          <div>
            <div className="font-medium text-foreground">永久保活的边界</div>
            平台会话有绝对有效期,本地无法让 cookie 永生;这里保证的是持续体检 + 当场告警 + 一键重登 + 自动回池,不让号静默死掉。
          </div>
        </CardContent>
      </Card>

      <ScanLoginDialog
        open={Boolean(reauth)}
        onOpenChange={(open) => {
          if (!open) setReauth(null)
        }}
        defaultPlatform={reauth?.platform}
        accountId={reauth?.accountId}
        onSuccess={() => {
          setReauth(null)
          toast.success('登录成功,已回池')
          void load()
        }}
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
