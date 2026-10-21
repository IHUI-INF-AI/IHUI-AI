// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Award, Gift, ListChecks, ShoppingBag, Stamp } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 10

/**
 * 积分中心 —— 对齐 web `/points`(总览 + 签到 + 流水 + 入口)。
 *
 * 端点按 apps/api/src/routes/gamification.ts 现读(前缀 /api):
 *  - GET  /api/points              ⇒ { points: { points, totalEarned, totalSpent, level, experience } }
 *  - GET  /api/points/transactions ⇒ { list, total, page, pageSize }
 *  - GET  /api/sign-in/today       ⇒ { signedIn, consecutiveDays, todayReward, week, record }
 *  - POST /api/sign-in             ⇒ 201 { record, points };已签到返回 409(方法为 POST)
 *  - GET  /api/levels/current      ⇒ { current, next, experience, progress, points }
 *  - GET  /api/leaderboard         ⇒ { list }(排行榜已有 Ranking 屏,本屏不重复该板块)
 * 签到历史(/api/sign-in/history)与排行榜全量见既有 CheckIn / Ranking 屏。
 */
interface PointsAccount {
  points: number
  totalEarned: number
  totalSpent: number
  level: number
  experience: number
}

interface LevelInfo {
  current: { level: number; name: string; minExperience: number } | null
  next: { level: number; name: string; minExperience: number } | null
  experience: number
  progress: number
}

interface SignInToday {
  signedIn: boolean
  consecutiveDays: number
  todayReward: number
  week: { date: string; reward: number; signed: boolean }[]
}

interface TxRow {
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
  const navigation = useNavigation<NavigationProp>()

  const [account, setAccount] = useState<PointsAccount | null>(null)
  const [level, setLevel] = useState<LevelInfo | null>(null)
  const [today, setToday] = useState<SignInToday | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const [txs, setTxs] = useState<TxRow[]>([])
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
        fetchApi<{ points: PointsAccount }>('/api/points'),
        fetchApi<LevelInfo>('/api/levels/current'),
        fetchApi<SignInToday>('/api/sign-in/today'),
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
      const res = await fetchApi<{ list: TxRow[]; total: number }>(
        `/api/points/transactions?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      )
      if (!res.success) throw new Error(res.error)
      const rows = res.data?.list ?? []
      setTxs((prev) => (append ? [...prev, ...rows] : rows))
      setTxTotal(res.data?.total ?? 0)
    } catch {
      if (!append) {
        setTxs([])
        setTxTotal(0)
      }
      setTxFailed(true)
    } finally {
      setTxLoading(false)
    }
  }, [])

  const loadMoreTxs = async () => {
    const next = txPage + 1
    await loadTxs(next, true)
    setTxPage(next)
  }

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  useEffect(() => {
    void loadTxs(1)
  }, [loadTxs])

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

  const styles = makeStyles()
  const remaining = level?.next
    ? Math.max(0, level.next.minExperience - (level.experience ?? 0))
    : 0

  const stats = [
    { key: 'current', label: t('points.current'), value: account?.points },
    { key: 'earned', label: t('points.totalEarned'), value: account?.totalEarned },
    { key: 'spent', label: t('points.totalSpent'), value: account?.totalSpent },
    { key: 'level', label: t('points.level'), value: account ? `Lv.${account.level}` : undefined },
  ]

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('points.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.subtitle}>{t('points.subtitle')}</Text>

        {loading ? (
          <ActivityIndicator style={styles.stateBox} color={tokens.text.tertiary} />
        ) : failed ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{t('points.loadFailed')}</Text>
            <TouchableOpacity onPress={() => void loadOverview()} activeOpacity={0.7}>
              <Text style={styles.retry}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.statGrid}>
              {stats.map((s) => (
                <View key={s.key} style={styles.statCard}>
                  <Text style={styles.statLabel}>{s.label}</Text>
                  <Text style={styles.statValue}>{s.value ?? '—'}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Award size={16} color={tokens.text.secondary} />
                <Text style={styles.cardTitle}>{level?.current?.name ?? t('points.level')}</Text>
                <Text style={styles.cardMuted}>
                  {level?.next
                    ? t('points.nextLevel', { name: level.next.name, points: remaining })
                    : t('points.maxLevel')}
                </Text>
              </View>
              <Text style={styles.cardMuted}>
                {t('points.experience')}: {level?.experience ?? account?.experience ?? 0}
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Stamp size={16} color={tokens.text.secondary} />
                <Text style={styles.cardTitle}>{t('points.signIn.title')}</Text>
                <Text style={styles.cardMuted}>
                  {today?.signedIn ? t('points.signIn.signedIn') : t('points.signIn.notSignedIn')}
                </Text>
              </View>
              <Text style={styles.cardMuted}>
                {t('points.signIn.consecutive', { days: today?.consecutiveDays ?? 0 })} ·{' '}
                {t('points.signIn.todayReward')}: {today?.todayReward ?? 0}
              </Text>
              <TouchableOpacity
                style={[styles.button, (signing || today?.signedIn) && styles.buttonDisabled]}
                onPress={() => void onSignIn()}
                disabled={signing || !!today?.signedIn}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonText}>
                  {today?.signedIn
                    ? t('points.signIn.signedIn')
                    : signing
                      ? t('points.signIn.signing')
                      : t('points.signIn.signInBtn')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.entryRow}>
              <TouchableOpacity
                style={styles.entryBtn}
                onPress={() => navigation.navigate('PointsMall')}
                activeOpacity={0.7}
              >
                <ShoppingBag size={16} color={tokens.text.primary} />
                <Text style={styles.entryText}>{t('points.mallLink')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.entryBtn}
                onPress={() => navigation.navigate('TaskCenter')}
                activeOpacity={0.7}
              >
                <ListChecks size={16} color={tokens.text.primary} />
                <Text style={styles.entryText}>{t('points.taskCenterLink')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.entryBtn}
                onPress={() => navigation.navigate('PointRule')}
                activeOpacity={0.7}
              >
                <Gift size={16} color={tokens.text.primary} />
                <Text style={styles.entryText}>{t('points.ruleLink')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('points.txTitle')}</Text>
              {txLoading ? (
                <ActivityIndicator style={styles.txState} color={tokens.text.tertiary} />
              ) : txFailed ? (
                <View style={styles.txState}>
                  <Text style={styles.errorText}>{t('points.loadFailed')}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setTxPage(1)
                      void loadTxs(1)
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.retry}>{t('common.retry')}</Text>
                  </TouchableOpacity>
                </View>
              ) : txs.length === 0 ? (
                <Text style={styles.cardMuted}>{t('points.empty')}</Text>
              ) : (
                txs.map((tx) => {
                  const positive = tx.type !== 'spend'
                  return (
                    <View key={tx.id} style={styles.txRow}>
                      <View style={styles.txMain}>
                        <Text style={styles.txSource} numberOfLines={1}>
                          {tx.description || tx.source}
                        </Text>
                        <Text style={styles.cardMuted}>{fmt(tx.createdAt)}</Text>
                      </View>
                      <View style={styles.txRight}>
                        <Text style={[styles.txAmount, positive ? styles.txIn : styles.txOut]}>
                          {positive ? '+' : '-'}
                          {tx.amount}
                        </Text>
                        <Text style={styles.cardMuted}>
                          {t('points.balance')}: {tx.balanceAfter}
                        </Text>
                      </View>
                    </View>
                  )
                })
              )}
              {!txLoading && txs.length < txTotal ? (
                <TouchableOpacity
                  style={styles.moreBtn}
                  onPress={() => void loadMoreTxs()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moreText}>
                    {t('points.loadMore')} ({txs.length}/{txTotal})
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: 12, gap: 10, paddingBottom: 32 },
    subtitle: { fontSize: 12, color: tokens.text.tertiary },
    stateBox: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 48 },
    errorText: { fontSize: 13, color: tokens.danger.DEFAULT },
    retry: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statCard: {
      width: '48%',
      flexGrow: 1,
      padding: 12,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: 2,
    },
    statLabel: { fontSize: 11, color: tokens.text.tertiary },
    statValue: { fontSize: 20, fontWeight: '700', color: tokens.text.primary },
    card: {
      padding: 16,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: 8,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: tokens.text.primary },
    cardMuted: { fontSize: 12, color: tokens.text.secondary, lineHeight: 18 },
    button: {
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontSize: 15, fontWeight: '600', color: tokens.brand.ctaForeground },
    entryRow: { flexDirection: 'row', gap: 8 },
    entryBtn: {
      flex: 1,
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      backgroundColor: tokens.surface.card,
    },
    entryText: { fontSize: 12, color: tokens.text.primary },
    txState: { paddingVertical: 16, gap: 6 },
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.border.light,
    },
    txMain: { flex: 1, gap: 2 },
    txSource: { fontSize: 13, color: tokens.text.primary },
    txRight: { alignItems: 'flex-end', gap: 2 },
    txAmount: { fontSize: 14, fontWeight: '700' },
    txIn: { color: tokens.success.DEFAULT },
    txOut: { color: tokens.danger.DEFAULT },
    moreBtn: {
      height: 40,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreText: { fontSize: 13, color: tokens.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
