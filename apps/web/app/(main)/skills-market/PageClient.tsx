// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Wand2,
  Search,
  Star,
  Download,
  Power,
  PowerOff,
  Loader2,
  Bell,
  BellOff,
  User,
  Eye,
  EyeOff,
} from 'lucide-react'

import {
  enableSkill,
  disableSkill,
  fetchEnabledSkills,
  fetchSkillOwnership,
  setSkillListing,
  type SkillOwnership,
} from '@ihui/api-client/endpoints/skills-market'
import {
  fetchSkillsMarket,
  installSkill,
  rateSkill,
  fetchSkillRatings,
  fetchSkillSubscription,
  subscribeSkill,
  unsubscribeSkill,
} from '@/lib/skills-market-api'
import type { SkillMarketEntry } from '@ihui/shared/skills/market'
import { BackButton } from '@/components/common'
import { Badge } from '@/components/data'
import { Button, Input } from '@ihui/ui-react'

/**
 * Skill 市场 — 第三梯队 #14 自进化 Skill 市场产品化(2026-09-15 立)
 *
 * 定位:把 skills.py 自进化底座产出的市场条目作为可浏览/可检索/可评分/可一键安装
 * 的一站式商店;安装是一次性入库,启用/停用是用户级运行态开关(二者正交)。
 * 接口(均经 apps/api 代理):
 *   GET  /api/skills/market(q/tag 分页检索)
 *   POST /api/skills/:name/install | /rate | /enable | /disable | /subscribe
 *   GET  /api/skills/enabled | /:name/ratings
 *   POST /api/skills/:name/listing + GET /api/skills/:name/ownership
 *     ↑ P2-14 补齐的 listing 级上下架与 owner 判定(仅上架者可见该按钮)
 *
 * 深链(2026-09-25 补):本组件同时服务 `/skills-market` 与 `/skills-market/[id]`,
 * 后者传 `deepLinkName`,按 name 反查后自动打开同一份详情弹层 —— 只有一个详情实现,
 * 不存在"页面版 + 弹层版"双轨。
 */
export default function SkillsMarketPageClient({ deepLinkName }: { deepLinkName?: string }) {
  const t = useTranslations('skillMarket')
  const qc = useQueryClient()
  const router = useRouter()
  const [q, setQ] = React.useState('')
  const [debouncedQ, setDebouncedQ] = React.useState('')
  const [tag, setTag] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [detail, setDetail] = React.useState<SkillMarketEntry | null>(null)
  const [actingName, setActingName] = React.useState<string | null>(null)

  // 搜索防抖(300ms):避免每键一次请求
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  const { data, isLoading, error } = useQuery({
    queryKey: ['skills-market', 'list', { q: debouncedQ, tag, page }],
    queryFn: () => fetchSkillsMarket({ q: debouncedQ, tag, page, pageSize: 20 }),
  })

  /**
   * 深链条目解析:/skills-market/[id] 用 name 反查市场条目。
   * 走既有的 GET /skills/market(q 精确匹配 name),**不新增第二个详情端点** ——
   * 列表端点已经把 `enabled === false` 的条目滤掉了,所以"已下架"与"不存在"
   * 在这里天然是同一个结果:查不到 ⇒ 空态。
   */
  const deepLinkQuery = useQuery({
    queryKey: ['skills-market', 'detail', deepLinkName ?? null],
    queryFn: async (): Promise<SkillMarketEntry | null> => {
      if (!deepLinkName) return null
      const r = await fetchSkillsMarket({ q: deepLinkName, page: 1, pageSize: 100 })
      return r.items.find((it) => it.name === deepLinkName) ?? null
    },
    enabled: Boolean(deepLinkName),
    retry: false,
  })

  // 命中即自动打开详情弹层(复用列表页那一份实现,不另起第二套详情 UI)
  React.useEffect(() => {
    if (deepLinkName && deepLinkQuery.data) setDetail(deepLinkQuery.data)
  }, [deepLinkName, deepLinkQuery.data])

  /** 关闭详情:在深链路由上顺带退回市场列表,否则留下一个没有详情的空 URL */
  const closeDetail = () => {
    setDetail(null)
    if (deepLinkName) router.push('/skills-market')
  }

  // 已启用集合(初始化启停状态;api-client 返回未拆包的 ApiResult,此处拆包)
  const { data: enabledData } = useQuery({
    queryKey: ['skills-market', 'enabled'],
    queryFn: async (): Promise<{ enabled: string[] }> => {
      const r = await fetchEnabledSkills()
      if (!r.success || !r.data) throw new Error(r.error ?? 'load failed')
      return r.data
    },
  })
  const enabledSet = React.useMemo(() => new Set(enabledData?.enabled ?? []), [enabledData])

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['skills-market', 'list'] })
    void qc.invalidateQueries({ queryKey: ['skills-market', 'enabled'] })
  }

  /** 启用/停用(乐观更新,失败回滚) */
  const handleToggle = async (entry: SkillMarketEntry) => {
    if (actingName) return
    const wasEnabled = enabledSet.has(entry.name)
    setActingName(entry.name)
    // 乐观:先在本地启用集上翻转
    qc.setQueryData<{ enabled: string[] }>(['skills-market', 'enabled'], (prev) => {
      const enabled = new Set(prev?.enabled ?? [])
      if (wasEnabled) enabled.delete(entry.name)
      else enabled.add(entry.name)
      return { enabled: Array.from(enabled) }
    })
    try {
      const r = wasEnabled ? await disableSkill(entry.name) : await enableSkill(entry.name)
      if (r.success) {
        toast.success(
          wasEnabled
            ? t('disableSuccess', { name: entry.name })
            : t('enableSuccess', { name: entry.name }),
        )
        refresh()
      } else {
        throw new Error(r.error ?? 'failed')
      }
    } catch {
      // 回滚
      qc.setQueryData<{ enabled: string[] }>(['skills-market', 'enabled'], (prev) => {
        const enabled = new Set(prev?.enabled ?? [])
        if (wasEnabled) enabled.add(entry.name)
        else enabled.delete(entry.name)
        return { enabled: Array.from(enabled) }
      })
      toast.error(t('actionFailed'))
    } finally {
      setActingName(null)
    }
  }

  /** 一键安装(入库 + 计数自增乐观) */
  const handleInstall = async (entry: SkillMarketEntry) => {
    if (actingName) return
    setActingName(entry.name)
    try {
      const r = await installSkill(entry.name)
      toast.success(t('installSuccess', { name: entry.name, count: r.installCount }))
      refresh()
    } catch {
      toast.error(t('actionFailed'))
    } finally {
      setActingName(null)
    }
  }

  const items = React.useMemo(() => data?.items ?? [], [data])
  const total = data?.total ?? 0
  const pageSize = data?.pageSize ?? 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // 标签聚合:从当前页条目收集(后端 tag 维度有限,足够筛选导航用)
  const tags = React.useMemo(() => {
    const s = new Set<string>()
    for (const it of items) for (const tg of it.tags) s.add(tg)
    return Array.from(s).slice(0, 12)
  }, [items])

  // 深链解析中:先给骨架,不要闪一屏"不存在"
  if (deepLinkName && deepLinkQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-4">
        <BackButton />
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('loading')}</span>
        </div>
      </div>
    )
  }

  // 深链直达一个不存在或已下架的 skill:必须给明确空态 + 回列表出口,不得白屏。
  // (下架即隐身:GET /skills/market 不返回 enabled === false 的条目,所以这里
  //  "查不到"同时覆盖"从没有过"与"已被上架者下架"两种情形。)
  if (deepLinkName && !deepLinkQuery.data) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6">
        <BackButton />
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm font-medium text-foreground">{t('notFoundTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('notFoundHint', { name: deepLinkName })}
          </p>
          <Link
            href="/skills-market"
            className="mt-4 inline-flex items-center text-xs text-primary hover:underline"
          >
            <span>{t('backToMarket')}</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-4">
      <BackButton />
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Wand2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          {!isLoading && !error && <Badge variant="primary">{t('count', { count: total })}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 过滤栏:关键词 + 标签 */}
      <div className="flex flex-col gap-2 min-[640px]:flex-row min-[640px]:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9"
            autoComplete="off"
          />
        </div>
        <select
          value={tag}
          onChange={(e) => {
            setTag(e.target.value)
            setPage(1)
          }}
          className="rounded-md border bg-card px-3 py-2 text-sm text-foreground"
          aria-label={t('tag')}
        >
          <option value="">{t('allTags')}</option>
          {tags.map((tg) => (
            <option key={tg} value={tg}>
              {tg}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('loading')}</span>
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {t('loadFailed')}
        </div>
      )}
      {!isLoading && !error && items.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p>{t('empty')}</p>
          <p className="mt-1 text-xs">{t('emptyHint')}</p>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {items.map((entry) => (
            <SkillCard
              key={entry.name}
              entry={entry}
              enabled={enabledSet.has(entry.name)}
              acting={actingName === entry.name}
              onInstall={() => void handleInstall(entry)}
              onToggle={() => void handleToggle(entry)}
              onOpenDetail={() => setDetail(entry)}
            />
          ))}
        </div>
      )}

      {/* 分页 */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('prevPage')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('pageIndicator', { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('nextPage')}
          </Button>
        </div>
      )}

      {detail && <SkillDetailDialog entry={detail} onClose={closeDetail} />}
    </div>
  )
}

/** 评分星渲染:满星按 score 取整,支持半读(仅展示,不做输入) */
function RatingStars({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={
            i <= Math.round(score)
              ? 'h-3 w-3 fill-amber-400 text-amber-400'
              : 'h-3 w-3 text-muted-foreground/40'
          }
        />
      ))}
    </span>
  )
}

/** 单条 Skill 卡片:元数据 / 评分 / 安装量 / 安装与启停 */
function SkillCard({
  entry,
  enabled,
  acting,
  onInstall,
  onToggle,
  onOpenDetail,
}: {
  entry: SkillMarketEntry
  enabled: boolean
  acting: boolean
  onInstall: () => void
  onToggle: () => void
  onOpenDetail: () => void
}) {
  const t = useTranslations('skillMarket')

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20">
      <div className="flex items-start gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Wand2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <button
            type="button"
            onClick={onOpenDetail}
            className="block w-full truncate text-left text-sm font-semibold leading-tight text-foreground hover:underline"
            aria-label={entry.name}
          >
            {entry.name}
          </button>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <RatingStars score={entry.rating} />
              {entry.ratingCount > 0
                ? t('ratingCount', { count: entry.ratingCount })
                : t('noRatings')}
            </span>
            <span className="inline-flex items-center gap-1">
              <Download className="h-3 w-3" />
              {t('installs', { count: entry.installCount })}
            </span>
          </div>
        </div>
      </div>
      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {entry.description}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        {entry.tags.slice(0, 3).map((tg) => (
          <Badge key={tg} variant="default">
            {tg}
          </Badge>
        ))}
        <span className="inline-flex items-center gap-1">
          <User className="h-3 w-3" />
          {entry.author}
        </span>
        <span>v{entry.version}</span>
      </div>
      <div className="mt-auto flex items-center gap-2">
        <Button
          variant={enabled ? 'outline' : 'default'}
          onClick={onToggle}
          disabled={acting}
          className="flex-1"
        >
          {acting ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : enabled ? (
            <>
              <PowerOff className="mr-1.5 h-3.5 w-3.5" />
              {t('disable')}
            </>
          ) : (
            <>
              <Power className="mr-1.5 h-3.5 w-3.5" />
              {t('enable')}
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onInstall} disabled={acting} className="flex-1">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {t('install')}
        </Button>
      </div>
    </div>
  )
}

/** 详情弹层:完整元数据 + 评分列表 + 评分表单 + 订阅开关 */
function SkillDetailDialog({ entry, onClose }: { entry: SkillMarketEntry; onClose: () => void }) {
  const t = useTranslations('skillMarket')
  const qc = useQueryClient()
  const [score, setScore] = React.useState(5)
  const [comment, setComment] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const {
    data: ratings,
    refetch: refetchRatings,
    isLoading: ratingsLoading,
  } = useQuery({
    queryKey: ['skills-market', 'ratings', entry.name],
    queryFn: () => fetchSkillRatings(entry.name),
  })

  // 订阅状态(打开弹层时拉取;接口不可用时按未订阅处理,不阻塞弹层)
  const { data: subscription } = useQuery({
    queryKey: ['skills-market', 'subscription', entry.name],
    queryFn: () => fetchSkillSubscription(entry.name),
    staleTime: 0,
  })
  const subscribed = subscription?.subscribed ?? false

  /**
   * owner 判定(P2-14):只有上架者本人看见"上下架"按钮。
   * 隐藏按钮只是体验 —— 真正的授权在 POST /skills/:name/listing 里按 userId 再校一次,
   * 不得反过来把服务端校验当成可省略的一环。
   */
  const { data: ownership } = useQuery({
    queryKey: ['skills-market', 'ownership', entry.name],
    queryFn: async (): Promise<SkillOwnership | null> => {
      const r = await fetchSkillOwnership(entry.name)
      return r.success ? (r.data ?? null) : null
    },
    staleTime: 0,
    retry: false,
  })
  const [listingToggling, setListingToggling] = React.useState(false)

  const handleToggleListing = async () => {
    if (!ownership || listingToggling) return
    const next = !ownership.enabled
    setListingToggling(true)
    try {
      const r = await setSkillListing(entry.name, next)
      if (!r.success) throw new Error(r.error ?? 'failed')
      toast.success(next ? t('relistSuccess') : t('unlistSuccess'))
      void qc.invalidateQueries({ queryKey: ['skills-market'] })
    } catch {
      toast.error(t('actionFailed'))
    } finally {
      setListingToggling(false)
    }
  }

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['skills-market', 'list'] })
    void refetchRatings()
  }

  const handleSubmitRating = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await rateSkill(entry.name, { score, comment: comment.trim() || undefined })
      toast.success(t('ratingSuccess'))
      setComment('')
      refresh()
    } catch {
      toast.error(t('actionFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubscribe = async () => {
    try {
      const next = subscribed
        ? await unsubscribeSkill(entry.name)
        : await subscribeSkill(entry.name)
      toast.success(
        next.subscribed
          ? t('subscribed', { name: entry.name })
          : t('unsubscribed', { name: entry.name }),
      )
    } catch {
      toast.error(t('actionFailed'))
    }
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={entry.name}
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card p-5 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Wand2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-foreground">{entry.name}</h2>
              <Badge variant="primary">v{entry.version}</Badge>
              <Badge variant="default">{entry.license}</Badge>
              {ownership && !ownership.enabled && <Badge variant="default">{t('unlisted')}</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <RatingStars score={entry.rating} />
                {entry.rating.toFixed(1)} · {t('ratingCount', { count: entry.ratingCount })}
              </span>
              <span className="inline-flex items-center gap-1">
                <Download className="h-3 w-3" />
                {t('installs', { count: entry.installCount })}
              </span>
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" />
                {entry.author}
              </span>
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-foreground/90">{entry.description}</p>
        {entry.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entry.tags.map((tg) => (
              <Badge key={tg} variant="default">
                {tg}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <Button onClick={() => void handleSubscribe()}>
            {subscribed ? (
              <>
                <BellOff className="mr-1.5 h-3.5 w-3.5" />
                {t('unsubscribe')}
              </>
            ) : (
              <>
                <Bell className="mr-1.5 h-3.5 w-3.5" />
                {t('subscribe')}
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
          {ownership?.isOwner && (
            <Button
              variant="outline"
              onClick={() => void handleToggleListing()}
              disabled={listingToggling}
            >
              {listingToggling ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : ownership.enabled ? (
                <EyeOff className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Eye className="mr-1.5 h-3.5 w-3.5" />
              )}
              {ownership.enabled ? t('unlist') : t('relist')}
            </Button>
          )}
        </div>

        {/* 评分区 */}
        <div className="mt-5 space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold text-foreground">{t('ratingsTitle')}</h3>
          {ratingsLoading && (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('loading')}
            </div>
          )}
          {!ratingsLoading && (ratings ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">{t('noRatings')}</p>
          )}
          {(ratings ?? []).map((r) => (
            <div key={r.id} className="rounded-md border bg-muted/30 p-2.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-foreground">{r.userName}</span>
                <RatingStars score={r.score} />
                <span className="ml-auto text-muted-foreground">{r.createdAt.slice(0, 10)}</span>
              </div>
              {r.comment && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.comment}</p>
              )}
            </div>
          ))}

          {/* 评分表单 */}
          <div className="mt-3 space-y-2 rounded-md border p-3">
            <p className="text-xs font-medium text-foreground">{t('rateTitle')}</p>
            <div
              className="flex items-center gap-1.5"
              role="radiogroup"
              aria-label={t('yourScore')}
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={score === i}
                  onClick={() => setScore(i)}
                  className="rounded p-0.5 transition-colors hover:bg-accent"
                >
                  <Star
                    className={
                      i <= score
                        ? 'h-4 w-4 fill-amber-400 text-amber-400'
                        : 'h-4 w-4 text-muted-foreground/40'
                    }
                  />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('commentPlaceholder')}
              rows={2}
              className="w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <Button size="sm" onClick={() => void handleSubmitRating()} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {t('submitRating')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
