// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  disableSkill,
  enableSkill,
  fetchEnabledSkills,
  fetchMarketSkills,
  fetchSkillRatings,
  fetchSkillSubscription,
  installSkill,
  rateSkillEntry,
  subscribeSkillEntry,
  unsubscribeSkillEntry,
  type SkillMarketItem,
  type SkillRating,
} from '@ihui/api-client'
import {
  SkillsMarketScreen as SharedSkillsMarketScreen,
  type SkillDetailView,
  type SkillMarketRowView,
  type SkillRatingRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 与后端分页默认同值(pageSize 默认 20 上限 100,apps/api/src/routes/skills.ts:223-228) */
const PAGE_SIZE = 20
const NS = 'skillMarketPage'

/**
 * RN 端「技能市场」薄壳 —— 承载 web /skills/market。
 *
 * 取数与口径:
 *  - 目录 GET /api/skills/market?q&tag&page&pageSize → success({ items, total, page, pageSize })
 *    (apps/api/src/routes/skills.ts:744-774)
 *  - 用户启用集 GET /api/skills/enabled → success({ enabled })  (skills.ts:1309-1314)
 *  - 安装 POST /api/skills/:name/install (skills.ts:777-815)
 *  - 启停 POST /api/skills/:name/enable|disable (skills.ts:1317 / 1338)
 *  - 详情评分 GET /api/skills/:name/ratings → success({ ratings, total }) (skills.ts:1119-1130)、
 *    提交 POST /api/skills/:name/rate (skills.ts:1072-1116)
 *  - 订阅 GET/POST/DELETE /api/skills/:name/subscription|subscribe (skills.ts:1135-1193)
 * 全部需登录 ⇒ 未登录只显登录门,不发注定 401 的请求(web useAuthGate 同口径)。
 *
 * 口径差(如实登记):web 的「发布技能」弹层与「通知」弹层在 RN 未承载(本屏不含入口,
 * 不造死按钮);web 评分/安装成功走 toast,RN 无全局 toast,改为静默刷新 + 失败显错误行。
 */
export function SkillsMarketScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [rows, setRows] = useState<SkillMarketItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [tag, setTag] = useState('')
  const [enabled, setEnabled] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actingName, setActingName] = useState<string | null>(null)

  /** 打开详情时锁定的条目快照:翻页后列表行会变,详情不能跟着消失 */
  const [detailEntry, setDetailEntry] = useState<SkillMarketItem | null>(null)
  const [detailRatings, setDetailRatings] = useState<SkillRatingRowView[]>([])
  const [ratingsLoading, setRatingsLoading] = useState(false)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [subscribePending, setSubscribePending] = useState(false)
  const requestSeq = useRef(0)

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

  // 搜索防抖 300ms(web PageClient.tsx:82-88 同参)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const loadEnabled = useCallback(async () => {
    const res = await fetchEnabledSkills()
    if (res.success && res.data) setEnabled(res.data.enabled ?? [])
  }, [])

  const loadList = useCallback(
    async (nextPage: number) => {
      if (!user) return
      const seq = ++requestSeq.current
      setLoading(true)
      try {
        const res = await fetchMarketSkills({
          q: debouncedQuery,
          tag,
          page: nextPage,
          pageSize: PAGE_SIZE,
        })
        if (seq !== requestSeq.current) return
        if (!res.success || !res.data) {
          setError(res.error ?? t('common.loadFailed'))
          setRows([])
          setTotal(0)
          return
        }
        setError(null)
        setRows(res.data.items ?? [])
        setTotal(res.data.total ?? 0)
        setPage(res.data.page ?? nextPage)
      } catch {
        if (seq !== requestSeq.current) return
        setError(t('common.loadFailed'))
      } finally {
        if (seq === requestSeq.current) setLoading(false)
      }
    },
    [user, debouncedQuery, tag, t],
  )

  useEffect(() => {
    void loadList(1)
  }, [loadList])

  useEffect(() => {
    void loadEnabled()
  }, [loadEnabled])

  const loadRatings = useCallback(
    async (name: string) => {
      setRatingsLoading(true)
      try {
        const res = await fetchSkillRatings(name)
        const list: SkillRating[] = res.success && res.data ? (res.data.ratings ?? []) : []
        setDetailRatings(
          list.map((r) => ({
            id: r.id,
            userName: r.userName,
            score: r.score,
            comment: r.comment,
            timeText: fmtDate(r.createdAt),
          })),
        )
      } catch {
        setDetailRatings([])
      } finally {
        setRatingsLoading(false)
      }
    },
    [fmtDate],
  )

  const openDetail = useCallback(
    (name: string) => {
      const hit = rows.find((item) => item.name === name) ?? null
      setDetailEntry(hit)
      setDetailRatings([])
      setSubscribed(false)
      void loadRatings(name)
      void fetchSkillSubscription(name)
        .then((res) => {
          if (res.success && res.data) setSubscribed(res.data.subscribed)
        })
        .catch(() => setSubscribed(false))
    },
    [rows, loadRatings],
  )

  const closeDetail = useCallback(() => setDetailEntry(null), [])

  const handleInstall = useCallback(
    async (name: string) => {
      if (actingName) return
      setActingName(name)
      try {
        const res = await installSkill(name)
        if (!res.success) setError(t(`${NS}.actionFailed`))
        else {
          setError(null)
          await loadEnabled()
          await loadList(page)
        }
      } catch {
        setError(t(`${NS}.actionFailed`))
      } finally {
        setActingName(null)
      }
    },
    [actingName, loadEnabled, loadList, page, t],
  )

  const handleToggleEnabled = useCallback(
    async (name: string) => {
      if (actingName) return
      const wasEnabled = enabled.includes(name)
      setActingName(name)
      setEnabled((prev) => (wasEnabled ? prev.filter((n) => n !== name) : [...prev, name]))
      try {
        const res = wasEnabled ? await disableSkill(name) : await enableSkill(name)
        if (!res.success) {
          setEnabled((prev) => (wasEnabled ? [...prev, name] : prev.filter((n) => n !== name)))
          setError(t(`${NS}.actionFailed`))
        } else {
          setError(null)
        }
      } catch {
        setEnabled((prev) => (wasEnabled ? [...prev, name] : prev.filter((n) => n !== name)))
        setError(t(`${NS}.actionFailed`))
      } finally {
        setActingName(null)
      }
    },
    [actingName, enabled, t],
  )

  const handleSubmitRating = useCallback(
    async (score: number, comment: string) => {
      if (!detailEntry || ratingSubmitting) return
      setRatingSubmitting(true)
      try {
        const res = await rateSkillEntry(detailEntry.name, { score, comment: comment || undefined })
        if (!res.success) setError(t(`${NS}.actionFailed`))
        else {
          setError(null)
          await loadRatings(detailEntry.name)
          await loadList(page)
        }
      } catch {
        setError(t(`${NS}.actionFailed`))
      } finally {
        setRatingSubmitting(false)
      }
    },
    [detailEntry, ratingSubmitting, loadRatings, loadList, page, t],
  )

  const handleToggleSubscribe = useCallback(async () => {
    if (!detailEntry || subscribePending) return
    setSubscribePending(true)
    try {
      const res = subscribed
        ? await unsubscribeSkillEntry(detailEntry.name)
        : await subscribeSkillEntry(detailEntry.name)
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
  }, [detailEntry, subscribePending, subscribed, t])

  const rowViews: SkillMarketRowView[] = useMemo(
    () =>
      rows.map((item) => ({
        name: item.name,
        description: item.description,
        tags: item.tags ?? [],
        author: item.author,
        version: item.version,
        rating: item.rating,
        ratingCount: item.ratingCount,
        installCount: item.installCount,
        enabled: enabled.includes(item.name),
      })),
    [rows, enabled],
  )

  const tagOptions = useMemo(() => {
    const set = new Set<string>()
    for (const item of rows) for (const tg of item.tags ?? []) set.add(tg)
    return Array.from(set).slice(0, 12)
  }, [rows])

  const detail: SkillDetailView | null = useMemo(() => {
    if (!detailEntry) return null
    return {
      name: detailEntry.name,
      description: detailEntry.description,
      tags: detailEntry.tags ?? [],
      author: detailEntry.author,
      version: detailEntry.version,
      license: detailEntry.license,
      rating: detailEntry.rating,
      ratingCount: detailEntry.ratingCount,
      installCount: detailEntry.installCount,
      subscribed,
      subscriberCount: 0,
      ratings: detailRatings,
      ratingsLoading,
      ratingSubmitting,
      subscribePending,
    }
  }, [detailEntry, subscribed, detailRatings, ratingsLoading, ratingSubmitting, subscribePending])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <SharedSkillsMarketScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      error={error}
      rows={rowViews}
      total={total}
      page={page}
      totalPages={totalPages}
      query={query}
      onQueryChange={setQuery}
      tag={tag}
      tags={tagOptions}
      onTagChange={setTag}
      onPrevPage={() => void loadList(Math.max(1, page - 1))}
      onNextPage={() => void loadList(Math.min(totalPages, page + 1))}
      onRefresh={() => void loadList(page)}
      actingName={actingName}
      onToggleEnabled={(name) => void handleToggleEnabled(name)}
      onInstall={(name) => void handleInstall(name)}
      detail={detail}
      onOpenDetail={openDetail}
      onCloseDetail={closeDetail}
      onSubmitRating={(score, comment) => void handleSubmitRating(score, comment)}
      onToggleSubscribe={() => void handleToggleSubscribe()}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
