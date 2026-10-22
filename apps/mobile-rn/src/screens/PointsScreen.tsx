// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  PointsScreen as SharedPointsScreen,
  type PointsAccountInfo,
  type PointsLevelInfo,
  type PointsSignInToday,
  type PointsTransactionItem,
} from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 10

/**
 * 积分中心 —— 对齐 web `/points`(总览 + 签到 + 流水 + 入口)。
 *
 * 〔门 39 六屏共享化第二批 2026-10-22〕UI 已下沉到共享层 `@ihui/rn-app` 的 PointsScreen ——
 * 本文件改成 wrapper,只留平台侧三件事:API 调用、导航、i18n/时间格式化/主题注入。
 * 统计卡/等级卡/签到卡/入口行/流水列表由共享层渲染,与 UsageScreen / PaymentScreen 同一型。
 * **不准**靠"补一条 @ihui/rn-app import"或塞白名单消门 39 的红 —— 那两条都不改真实共享度。
 *
 * 端点按 apps/api/src/routes/gamification.ts 现读(前缀 /api):
 *  - GET  /api/points              ⇒ { points: { points, totalEarned, totalSpent, level, experience } }
 *  - GET  /api/points/transactions ⇒ { list, total, page, pageSize }
 *  - GET  /api/sign-in/today       ⇒ { signedIn, consecutiveDays, todayReward, week, record }
 *  - POST /api/sign-in             ⇒ 201 { record, points };已签到返回 409(方法为 POST)
 *  - GET  /api/levels/current      ⇒ { current, next, experience, progress, points }
 * 签到历史(/api/sign-in/history)与排行榜全量见既有 CheckIn / Ranking 屏。
 */
interface RawAccount {
  points: number
  totalEarned: number
  totalSpent: number
  level: number
  experience: number
}

interface RawLevel {
  current: { level: number; name: string; minExperience: number } | null
  next: { level: number; name: string; minExperience: number } | null
  experience: number
  progress: number
}

interface RawSignInToday {
  signedIn: boolean
  consecutiveDays: number
  todayReward: number
  week: { date: string; reward: number; signed: boolean }[]
}

interface RawTxRow {
  id: string
  type: string
  source: string
  amount: number
  balanceAfter: number
  description: string | null
  createdAt: string
}

export default function PointsScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [account, setAccount] = useState<RawAccount | null>(null)
  const [level, setLevel] = useState<RawLevel | null>(null)
  const [today, setToday] = useState<RawSignInToday | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const [rows, setRows] = useState<RawTxRow[]>([])
  const [txTotal, setTxTotal] = useState(0)
  const [txPage, setTxPage] = useState(1)
  const [txLoading, setTxLoading] = useState(true)
  const [txFailed, setTxFailed] = useState(false)
  const [signing, setSigning] = useState(false)

  const fmt = useCallback(
    (iso: string) => {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return iso
      return new Intl.DateTimeFormat(locale, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    },
    [locale],
  )

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const [pRes, lRes, sRes] = await Promise.all([
        fetchApi<{ points: RawAccount }>('/api/points'),
        fetchApi<RawLevel>('/api/levels/current'),
        fetchApi<RawSignInToday>('/api/sign-in/today'),
      ])
      setAccount(pRes.success ? (pRes.data?.points ?? null) : null)
      setLevel(lRes.success ? (lRes.data ?? null) : null)
      setToday(sRes.success ? (sRes.data ?? null) : null)
      if (!pRes.success) setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTxs = useCallback(async (targetPage: number, append = false) => {
    setTxLoading(true)
    setTxFailed(false)
    try {
      const res = await fetchApi<{ list: RawTxRow[]; total: number }>(
        `/api/points/transactions?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      )
      if (!res.success) throw new Error(res.error)
      const list = res.data?.list ?? []
      setRows((prev) => (append ? [...prev, ...list] : list))
      setTxTotal(res.data?.total ?? 0)
    } catch {
      if (!append) {
        setRows([])
        setTxTotal(0)
      }
      setTxFailed(true)
    } finally {
      setTxLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  useEffect(() => {
    void loadTxs(1)
  }, [loadTxs])

  const loadMoreTxs = async () => {
    const next = txPage + 1
    await loadTxs(next, true)
    setTxPage(next)
  }

  const onSignIn = async () => {
    setSigning(true)
    try {
      const res = await fetchApi<{
        record: { consecutiveDays: number; rewardPoints: number }
        points: { points: number }
      }>('/api/sign-in', { method: 'POST' })
      if (!res.success) {
        // 409 = 今日已签到(后端唯一冲突分支),按"已签到"提示并刷新周历与总览
        appAlert(t('common.hint'), t('points.signIn.alreadySigned'))
        await loadOverview()
        return
      }
      const reward = res.data?.record?.rewardPoints ?? 0
      appAlert(t('points.signIn.title'), t('points.signIn.signInSuccess', { points: reward }))
      await loadOverview()
      setTxPage(1)
      await loadTxs(1)
    } catch {
      appAlert(t('common.error'), t('points.signIn.signInFailed'))
    } finally {
      setSigning(false)
    }
  }

  /** 共享层只认算好的视图模型:时间文本、收支方向、行标题都归平台(与后端契约同处)。 */
  const txs = txRowsToItems(rows, fmt)
  const overviewAccount: PointsAccountInfo | null = account
  const overviewLevel: PointsLevelInfo | null = level
  const signInToday: PointsSignInToday | null = today

  return (
    <SharedPointsScreen
      t={t}
      account={overviewAccount}
      level={overviewLevel}
      today={signInToday}
      loading={loading}
      failed={failed}
      signing={signing}
      txs={txs}
      txTotal={txTotal}
      txLoading={txLoading}
      txFailed={txFailed}
      onRetryOverview={() => void loadOverview()}
      onRetryTxs={() => {
        setTxPage(1)
        void loadTxs(1)
      }}
      onLoadMoreTxs={() => void loadMoreTxs()}
      onSignIn={() => void onSignIn()}
      onOpenMall={() => navigation.navigate('PointsMall')}
      onOpenTasks={() => navigation.navigate('TaskCenter')}
      onOpenRules={() => navigation.navigate('PointRule')}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}

/** 行 → 共享层视图模型:`type !== 'spend'` 即收入,标题 description 优先回落 source。 */
function txRowsToItems(rows: RawTxRow[], fmt: (iso: string) => string): PointsTransactionItem[] {
  return rows.map((tx) => ({
    id: tx.id,
    title: tx.description || tx.source,
    createdAtText: fmt(tx.createdAt),
    amount: tx.amount,
    income: tx.type !== 'spend',
    balanceAfter: tx.balanceAfter,
  }))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
