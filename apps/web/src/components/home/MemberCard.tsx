// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, LogIn, UserCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@ihui/ui-react'
import { Avatar } from '@/components/data/Avatar'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { getUserStatistics, getBalance } from '@ihui/api-client'
import { aggregateUsageFaces, toUsageFaceOutcome } from '@/lib/usage-face-semantics'

/** 首页用量卡读到的最小字段面(聚合分区渲染用) */
interface HomeUserStats {
  points: number
  followingCount: number
  fansCount: number
}

interface HomeWalletBalance {
  balance: number
}

export function MemberCard() {
  const t = useTranslations('home.memberCard')
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // G-652 首页用量聚合出口:stats=必须面(身份用量核心),wallet=可选面。
  // 查询层只做双语义分类(toUsageFaceOutcome),不吞错:transport 失败(429/网络/超时)
  // 与 HTTP200 信封失败(code!=0,后端报错)分开携带,由 aggregateUsageFaces 裁决。
  const { data: statsOutcome } = useQuery({
    queryKey: ['home', 'user-stats'],
    queryFn: async () => toUsageFaceOutcome(await getUserStatistics()),
    enabled: isAuthenticated,
    retry: false,
  })

  const { data: walletOutcome } = useQuery({
    queryKey: ['home', 'wallet-balance'],
    queryFn: async () => toUsageFaceOutcome(await getBalance()),
    enabled: isAuthenticated,
    retry: false,
  })

  // 可选面 wallet 的累计 transport 失败计数由本组件持有(纯函数不藏状态)
  const walletFailureCountRef = React.useRef(0)
  const usageAggregate = React.useMemo(
    () =>
      aggregateUsageFaces(
        [
          { id: 'user-stats', mandatory: true, outcome: statsOutcome },
          { id: 'wallet-balance', mandatory: false, outcome: walletOutcome },
        ],
        { 'wallet-balance': walletFailureCountRef.current },
      ),
    [statsOutcome, walletOutcome],
  )
  React.useEffect(() => {
    if (usageAggregate.shape === 'aggregate') {
      walletFailureCountRef.current = usageAggregate.failureCounts['wallet-balance'] ?? 0
    }
  }, [usageAggregate])

  // 签到状态统一走 react-query,与 stats/wallet 同缓存源,避免独立 fetch 不同步
  const { data: checkInStatus } = useQuery({
    queryKey: ['home', 'check-in-status'],
    queryFn: async () => {
      const r = await fetchApi<{ signedIn: boolean }>('/api/user/check-in/status')
      return r.success && r.data ? r.data.signedIn : false
    },
    enabled: isAuthenticated,
    retry: false,
  })
  const checkedIn = checkInStatus ?? false

  const checkInMut = useMutation({
    mutationFn: async () => {
      const r = await fetchApi<{ signedIn: boolean }>('/api/user/check-in', { method: 'POST' })
      if (!r.success) throw new Error(r.error)
      return r.data?.signedIn ?? true
    },
    onSuccess: (signedIn) => {
      qc.setQueryData(['home', 'check-in-status'], signedIn)
      void qc.invalidateQueries({ queryKey: ['home', 'user-stats'] })
      toast.success(t('checkInSuccess'))
    },
    onError: (e: Error) => toast.error(t('checkInFailed'), { description: e.message }),
  })

  // G-652 聚合出口分区渲染:fatal=整体红(整块替换,绝不渲染数字面);
  // aggregate=分区渲染,可选面 transport 失败的区显示"暂不可用 + 失败 N 次",绝不显示 0。
  const usageCells =
    usageAggregate.shape === 'aggregate'
      ? (() => {
          const statsSection = usageAggregate.sections.find((s) => s.faceId === 'user-stats')
          const walletSection = usageAggregate.sections.find((s) => s.faceId === 'wallet-balance')
          const walletDropped = usageAggregate.dropped.find((d) => d.faceId === 'wallet-balance')
          const stats =
            statsSection && statsSection.status === 'ready'
              ? (statsSection.data as HomeUserStats)
              : null
          const wallet =
            walletSection && walletSection.status === 'ready'
              ? (walletSection.data as HomeWalletBalance)
              : null
          return [
            { key: 'points', label: t('points'), href: '/settings', value: stats ? String(stats.points) : '—', unavailable: false, droppedCount: 0 },
            {
              key: 'balance',
              label: t('balance'),
              href: '/wallet',
              value: wallet ? String(wallet.balance) : '—',
              unavailable: walletSection?.status === 'unavailable',
              droppedCount: walletDropped?.count ?? 0,
            },
            { key: 'following', label: t('following'), href: '/settings', value: stats ? String(stats.followingCount) : '—', unavailable: false, droppedCount: 0 },
            { key: 'fans', label: t('fans'), href: '/settings', value: stats ? String(stats.fansCount) : '—', unavailable: false, droppedCount: 0 },
          ]
        })()
      : null

  const quickLinks = [
    { label: t('allCourses'), href: '/learn' },
    { label: t('featuredArticles'), href: '/article' },
    { label: t('askCommunity'), href: '/ask' },
    { label: t('learningCircle'), href: '/circle' },
  ]

  return (
    <aside className="w-full shrink-0 border-t min-[768px]:w-[280px] min-[768px]:border-l min-[768px]:border-t-0">
      <div className="flex h-full flex-col justify-between p-3">
        {isAuthenticated ? (
          <>
            <div className="flex flex-col items-center text-center">
              <Avatar
                src={user?.avatar ?? undefined}
                name={user?.nickname ?? 'U'}
                size="xl"
                className="ring-2 ring-background shadow-sm"
              />
              <Link href="/settings" className="mt-3 text-base font-semibold hover:text-primary">
                {user?.nickname ?? t('defaultUser')}
              </Link>
              <button
                onClick={() => checkInMut.mutate()}
                disabled={checkedIn}
                className={`mt-3 inline-flex items-center gap-1.5 rounded-sm border px-4 py-1.5 text-xs transition-colors ${
                  checkedIn
                    ? 'border-border text-muted-foreground'
                    : 'border-brand-accent-deep text-primary hover:bg-cta hover:text-cta-foreground'
                }`}
              >
                <CalendarCheck className="h-3.5 w-3.5" />
                {checkedIn ? t('signedIn') : t('signIn')}
              </button>
            </div>
            {usageAggregate.shape === 'fatal' ? (
              // G-652 (b) 整体红:后端报错(HTTP200 信封失败)或必须面失败,不渲染任何数字面
              <div
                role="alert"
                className="mt-5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-4 text-center text-xs text-destructive"
              >
                用量数据加载失败:{usageAggregate.message}
              </div>
            ) : (
              usageCells && (
                <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
                  {usageCells.map((s) => (
                    <Link
                      key={s.key}
                      href={s.href}
                      className="flex flex-col items-center gap-0.5 bg-card py-3 transition-colors hover:bg-cta/5"
                    >
                      {s.unavailable ? (
                        // G-652 (a) 可选面 transport 失败:该区清空 + 计数行(绝不显示 0)
                        <>
                          <strong className="text-lg font-semibold text-muted-foreground">
                            暂不可用
                          </strong>
                          <span className="text-xs text-muted-foreground">{s.label}</span>
                          <span className="text-xs text-destructive">失败 {s.droppedCount} 次</span>
                        </>
                      ) : (
                        <>
                          <strong className="text-lg font-semibold text-primary">{s.value}</strong>
                          <span className="text-xs text-muted-foreground">{s.label}</span>
                        </>
                      )}
                    </Link>
                  ))}
                </div>
              )
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-muted to-muted/50 text-muted-foreground/40">
                <UserCircle2 className="h-8 w-8" />
              </div>
              <p className="mt-3 text-base font-medium">{t('welcome')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('loginHint')}</p>
              <Button
                size="sm"
                className="mt-4 w-full"
                onClick={() => useLoginDialogStore.getState().open('login')}
              >
                <LogIn className="mr-1 h-3.5 w-3.5" />
                {t('loginNow')}
              </Button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {quickLinks.map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 py-3 text-xs text-muted-foreground transition-colors hover:bg-cta/10 hover:text-primary"
                >
                  {q.label}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
