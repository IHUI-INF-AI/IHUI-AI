// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  disableSkill,
  enableSkill,
  fetchEnabledSkills,
  fetchMarketSkills,
  fetchSkillMarketRatings,
  fetchSkillMarketSubscription,
  fetchSkillOwnership,
  installSkill,
  rateSkillMarket,
  setSkillListing,
  subscribeSkillMarket,
  unsubscribeSkillMarket,
} from '@ihui/api-client'
import {
  SkillMarketDetailScreen,
  type SkillMarketDetailRatingItem,
  type SkillMarketDetailState,
  type SkillMarketDetailView,
} from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RouteProps = RouteProp<RootStackParamList, 'SkillsMarketDetail'>

/**
 * Skill 市场详情(mobile-rn 端 wrapper,对应 web `/skills-market/[id]`)
 *
 * 数据来源与 web 逐条对齐(不新增详情端点):
 *  - 条目本体 = `GET /api/skills/market?q=<name>` 精确反查
 *    (web apps/web/app/(main)/skills-market/PageClient.tsx:102-111 同一判据;
 *     后端已把 `enabled === false` 的条目对非 owner 隐身,apps/api/src/routes/skills.ts:758,
 *     所以"查不到"天然同时覆盖"从没有过"与"已被上架者下架"两种情形 ⇒ 落 notFound 空态)
 *  - 评分列表 / 订阅态 / owner 判定 / 运行态启用集各自独立取,取不到按 web 同口径降级
 *    (评分空列表、订阅按未订阅、owner 取不到就不给上下架按钮)
 *
 * 写操作成功后一律重取(评分会让服务端重算市场平均分,故连条目本体也要刷)。
 */
export function SkillsMarketDetailScreenShell() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<RouteProps>()
  const name = route.params?.name ?? ''

  const [state, setState] = useState<SkillMarketDetailState>('loading')
  const [entry, setEntry] = useState<SkillMarketDetailView | null>(null)
  const [ratings, setRatings] = useState<SkillMarketDetailRatingItem[]>([])
  const [ratingsLoading, setRatingsLoading] = useState(false)
  const [subscription, setSubscription] = useState<{
    subscribed: boolean
    subscriberCount: number
  } | null>(null)
  const [ownership, setOwnership] = useState<{ isOwner: boolean; enabled: boolean } | null>(null)
  const [runtimeEnabled, setRuntimeEnabled] = useState(false)
  const [pending, setPending] = useState<
    '' | 'subscribe' | 'install' | 'runtime' | 'rate' | 'listing'
  >('')
  const [score, setScore] = useState(5)
  const [comment, setComment] = useState('')

  const formatDate = useCallback(
    (iso: string) => {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
    },
    [locale],
  )

  /** 附属数据(评分/订阅/owner/启用集):任一失败只降级该块,不影响主条目 */
  const loadSideData = useCallback(
    async (skillName: string) => {
      setRatingsLoading(true)
      try {
        const r = await fetchSkillMarketRatings(skillName)
        // 后端 data 形态是 { ratings, total }(skills.ts:1129),不是裸数组
        setRatings(
          (r.success ? (r.data?.ratings ?? []) : []).map((x) => ({
            id: x.id,
            userName: x.userName,
            score: x.score,
            comment: x.comment ?? '',
            createdAt: formatDate(x.createdAt),
          })),
        )
      } catch {
        setRatings([])
      } finally {
        setRatingsLoading(false)
      }

      const sub = await fetchSkillMarketSubscription(skillName)
      setSubscription(sub.success && sub.data ? sub.data : null)

      const own = await fetchSkillOwnership(skillName)
      setOwnership(
        own.success && own.data ? { isOwner: own.data.isOwner, enabled: own.data.enabled } : null,
      )

      const enabled = await fetchEnabledSkills()
      setRuntimeEnabled(enabled.success ? (enabled.data?.enabled ?? []).includes(skillName) : false)
    },
    [formatDate],
  )

  const load = useCallback(async () => {
    if (!name) {
      setState('notFound')
      return
    }
    setState('loading')
    try {
      const res = await fetchMarketSkills({ q: name, page: 1, pageSize: 100 })
      if (!res.success) {
        setState('error')
        return
      }
      const hit = (res.data?.items ?? []).find((it) => it.name === name)
      if (!hit) {
        setState('notFound')
        return
      }
      setEntry({
        name: hit.name,
        description: hit.description,
        tags: hit.tags ?? [],
        author: hit.author,
        version: hit.version,
        license: hit.license,
        installCount: hit.installCount,
        rating: hit.rating,
        ratingCount: hit.ratingCount,
      })
      setState('ready')
      void loadSideData(name)
    } catch {
      setState('error')
    }
  }, [name, loadSideData])

  useEffect(() => {
    void load()
  }, [load])

  /** 市场目录重取(安装/评分/上下架都会改目录上的计数或在架态) */
  const reloadEntry = useCallback(async () => {
    const res = await fetchMarketSkills({ q: name, page: 1, pageSize: 100 })
    const hit = res.success ? (res.data?.items ?? []).find((it) => it.name === name) : undefined
    if (!hit) return
    setEntry({
      name: hit.name,
      description: hit.description,
      tags: hit.tags ?? [],
      author: hit.author,
      version: hit.version,
      license: hit.license,
      installCount: hit.installCount,
      rating: hit.rating,
      ratingCount: hit.ratingCount,
    })
  }, [name])

  const fail = useCallback(() => appAlert(t('skillsMarketDetailPage.actionFailed')), [t])

  const onInstall = useCallback(async () => {
    if (pending || !name) return
    setPending('install')
    try {
      const r = await installSkill(name)
      if (r.success && r.data) {
        appAlert(t('skillsMarketDetailPage.installSuccess', { name, count: r.data.installCount }))
        void reloadEntry()
      } else fail()
    } catch {
      fail()
    } finally {
      setPending('')
    }
  }, [fail, name, pending, reloadEntry, t])

  const onToggleRuntime = useCallback(async () => {
    if (pending || !name) return
    const wasEnabled = runtimeEnabled
    setPending('runtime')
    try {
      const r = wasEnabled ? await disableSkill(name) : await enableSkill(name)
      if (r.success) {
        setRuntimeEnabled(!wasEnabled)
        appAlert(
          wasEnabled
            ? t('skillsMarketDetailPage.disableSuccess', { name })
            : t('skillsMarketDetailPage.enableSuccess', { name }),
        )
      } else fail()
    } catch {
      fail()
    } finally {
      setPending('')
    }
  }, [fail, name, pending, runtimeEnabled, t])

  const onToggleSubscribe = useCallback(async () => {
    if (pending || !name) return
    const next = !(subscription?.subscribed ?? false)
    setPending('subscribe')
    try {
      const r = next ? await subscribeSkillMarket(name) : await unsubscribeSkillMarket(name)
      if (r.success && r.data) {
        setSubscription(r.data)
        appAlert(
          r.data.subscribed
            ? t('skillsMarketDetailPage.subscribed', { name })
            : t('skillsMarketDetailPage.unsubscribed', { name }),
        )
      } else fail()
    } catch {
      fail()
    } finally {
      setPending('')
    }
  }, [fail, name, pending, subscription, t])

  const onSubmitRating = useCallback(async () => {
    if (pending || !name) return
    setPending('rate')
    try {
      const trimmed = comment.trim()
      const r = await rateSkillMarket(name, { score, comment: trimmed || undefined })
      if (r.success) {
        setComment('')
        appAlert(t('skillsMarketDetailPage.ratingSuccess'))
        void Promise.all([loadSideData(name), reloadEntry()])
      } else fail()
    } catch {
      fail()
    } finally {
      setPending('')
    }
  }, [comment, fail, loadSideData, name, pending, reloadEntry, score, t])

  const onToggleListing = useCallback(async () => {
    if (pending || !name || !ownership) return
    const next = !ownership.enabled
    setPending('listing')
    try {
      const r = await setSkillListing(name, next)
      if (r.success) {
        setOwnership({ ...ownership, enabled: next })
        appAlert(next ? t('skillsMarketDetailPage.relistSuccess') : t('skillsMarketDetailPage.unlistSuccess'))
        void load()
      } else fail()
    } catch {
      fail()
    } finally {
      setPending('')
    }
  }, [fail, load, name, ownership, pending, t])

  return (
    <SkillMarketDetailScreen
      t={t}
      colorScheme={resolvedTheme}
      state={state}
      entry={entry}
      requestedName={name}
      errorMessage=""
      ratings={ratings}
      ratingsLoading={ratingsLoading}
      subscription={subscription}
      ownership={ownership}
      runtimeEnabled={runtimeEnabled}
      pending={pending}
      score={score}
      comment={comment}
      onScoreChange={setScore}
      onCommentChange={setComment}
      onSubmitRating={() => void onSubmitRating()}
      onToggleSubscribe={() => void onToggleSubscribe()}
      onInstall={() => void onInstall()}
      onToggleRuntime={() => void onToggleRuntime()}
      onToggleListing={() => void onToggleListing()}
      onRetry={() => void load()}
      onBack={() => navigation.goBack()}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
