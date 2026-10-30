// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  fetchMarketSkills,
  fetchSkillRatings,
  fetchSkillSubscription,
  rateSkillEntry,
  subscribeSkillEntry,
  unsubscribeSkillEntry,
  type SkillMarketItem,
} from '@ihui/api-client'
import {
  SkillMarketDetailScreen as SharedSkillMarketDetailScreen,
  type SkillDetailView,
  type SkillRatingRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type DetailRoute = RouteProp<RootStackParamList, 'SkillMarketDetail'>

const NS = 'skillMarketPage'

/**
 * RN 端「Skill 深链详情」薄壳 —— 承载 web /skills-market/[id]。
 *
 * 解析方式与 web 完全同口径(apps/web/app/(main)/skills-market/PageClient.tsx:96-122、
 * 229-250):用 `GET /api/skills/market?q=<name>&page=1&pageSize=100`
 * (apps/api/src/routes/skills.ts:744-774)按 q 精确匹配 name **反查**市场条目,
 * 不新增第二个详情端点;列表端点已滤掉 `enabled === false` 的条目 ⇒
 * 「已下架」与「不存在」天然同一结果,统一进空态(带返回市场出口)。
 *
 * 评分/订阅取数与提交见 skills-market-engagement 端点封装;未登录只显登录门。
 * 该路由的参数 `{ name }` 由集成方在 RootNavigator 注册(见 manifest.navigator)。
 */
export function SkillMarketDetailScreen() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<DetailRoute>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const name = (route.params?.name ?? '').trim()

  const [entry, setEntry] = useState<SkillMarketItem | null>(null)
  const [notFoundName, setNotFoundName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ratings, setRatings] = useState<SkillRatingRowView[]>([])
  const [ratingsLoading, setRatingsLoading] = useState(false)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [subscribePending, setSubscribePending] = useState(false)

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }),
    [locale],
  )
  const fmtDate = useCallback(
    (value: string): string => {
      const d = new Date(value)
      return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
    },
    [dateFmt],
  )

  const loadRatings = useCallback(
    async (skillName: string) => {
      setRatingsLoading(true)
      try {
        const res = await fetchSkillRatings(skillName)
        const list = res.success && res.data ? (res.data.ratings ?? []) : []
        setRatings(
          list.map((r) => ({
            id: r.id,
            userName: r.userName,
            score: r.score,
            comment: r.comment,
            timeText: fmtDate(r.createdAt),
          })),
        )
      } catch {
        setRatings([])
      } finally {
        setRatingsLoading(false)
      }
    },
    [fmtDate],
  )

  /** 深链反查:q=name 精确匹配(web 同款,不新增详情端点) */
  useEffect(() => {
    let cancelled = false
    if (!user || !name) return
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const res = await fetchMarketSkills({ q: name, page: 1, pageSize: 100 })
        if (cancelled) return
        if (!res.success || !res.data) {
          setError(res.error ?? t('common.loadFailed'))
          return
        }
        const hit = (res.data.items ?? []).find((item) => item.name === name) ?? null
        setEntry(hit)
        setNotFoundName(hit ? null : name)
        if (hit) {
          void loadRatings(hit.name)
          void fetchSkillSubscription(hit.name)
            .then((r) => {
              if (!cancelled && r.success && r.data) setSubscribed(r.data.subscribed)
            })
            .catch(() => setSubscribed(false))
        }
      } catch {
        if (!cancelled) setError(t('common.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, name, t, loadRatings])

  const handleSubmitRating = useCallback(
    async (score: number, comment: string) => {
      if (!entry || ratingSubmitting) return
      setRatingSubmitting(true)
      try {
        const res = await rateSkillEntry(entry.name, { score, comment: comment || undefined })
        if (!res.success) setError(t(`${NS}.actionFailed`))
        else {
          setError(null)
          await loadRatings(entry.name)
        }
      } catch {
        setError(t(`${NS}.actionFailed`))
      } finally {
        setRatingSubmitting(false)
      }
    },
    [entry, ratingSubmitting, loadRatings, t],
  )

  const handleToggleSubscribe = useCallback(async () => {
    if (!entry || subscribePending) return
    setSubscribePending(true)
    try {
      const res = subscribed
        ? await unsubscribeSkillEntry(entry.name)
        : await subscribeSkillEntry(entry.name)
      if (!res.success) setError(t(`${NS}.actionFailed`))
      else {
        setError(null)
        setSubscribed(Boolean(res.data?.subscribed))
      }
    } catch {
      setError(t(`${NS}.actionFailed`))
    } finally {
      setSubscribePending(false)
    }
  }, [entry, subscribePending, subscribed, t])

  /**
   * 详情面不渲染 owner 上下架 / 安装启停:web 详情弹层里的这两个动作在 RN 未承载
   * (见 manifest ledger note),不在此先造点了没反应的入口。
   */
  const detail: SkillDetailView | null = useMemo(() => {
    if (!entry) return null
    return {
      name: entry.name,
      description: entry.description,
      tags: entry.tags ?? [],
      author: entry.author,
      version: entry.version,
      license: entry.license,
      rating: entry.rating,
      ratingCount: entry.ratingCount,
      installCount: entry.installCount,
      subscribed,
      subscriberCount: 0,
      ratings,
      ratingsLoading,
      ratingSubmitting,
      subscribePending,
    }
  }, [
    entry,
    subscribed,
    ratings,
    ratingsLoading,
    ratingSubmitting,
    subscribePending,
  ])

  return (
    <SharedSkillMarketDetailScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      error={error}
      notFoundName={notFoundName}
      detail={detail}
      onSubmitRating={(score, comment) => void handleSubmitRating(score, comment)}
      onToggleSubscribe={() => void handleToggleSubscribe()}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
