// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { CheckCircle2, FileText, Sparkles, X } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnRadiusFor } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type Filter = 'all' | 'unresolved' | 'resolved'

const PAGE_SIZE = 10

/**
 * 错题本 —— 对齐 web `/exam/wrong-questions`。
 *
 * 端点按 apps/api/src/routes/exam.ts 现读:
 *  - GET  /api/exam/wrong-questions?page&pageSize&examId&isResolved  ⇒ { list, total, page, pageSize }
 *  - GET  /api/exam/wrong-questions/stats                            ⇒ { stats: { total, unresolved, resolved, byType } }
 *  - PUT  /api/exam/wrong-questions/:questionId/resolve              ⇒ 标记已掌握(是 PUT,不是 POST)
 *  - POST /api/exam/wrong-questions/:questionId/explain              ⇒ { explanation, cached }
 * 行字段取 findWrongQuestionsByUser 的投影:paperTitle / questionTitle / wrongCount / isMastered / createdAt。
 */
interface WrongQuestion {
  id: string
  questionId: string
  paperId: string
  paperTitle: string | null
  questionTitle: string | null
  wrongCount: number
  isMastered: boolean
  createdAt: string
}

interface Stats {
  total: number
  unresolved: number
  resolved: number
}

export default function WrongQuestionsScreen() {
  const { t, locale } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const [list, setList] = useState<WrongQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<Filter>('all')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [resolving, setResolving] = useState<string | null>(null)
  const [explaining, setExplaining] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<{ title: string; text: string } | null>(null)

  const fmt = useCallback(
    (iso: string) => {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return iso
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    },
    [locale],
  )

  const loadList = useCallback(
    async (targetPage: number, append = false) => {
      setLoading(true)
      setFailed(false)
      try {
        const qs = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(PAGE_SIZE),
        })
        if (filter === 'unresolved') qs.set('isResolved', 'false')
        if (filter === 'resolved') qs.set('isResolved', 'true')
        const [listRes, statsRes] = await Promise.all([
          fetchApi<{ list: WrongQuestion[]; total: number }>(
            `/api/exam/wrong-questions?${qs.toString()}`,
          ),
          fetchApi<{ stats: Stats }>('/api/exam/wrong-questions/stats'),
        ])
        if (!listRes.success) throw new Error(listRes.error)
        const rows = listRes.data?.list ?? []
        setList((prev) => (append ? [...prev, ...rows] : rows))
        setTotal(listRes.data?.total ?? 0)
        setStats(statsRes.success ? (statsRes.data?.stats ?? null) : null)
      } catch {
        if (!append) {
          setList([])
          setTotal(0)
        }
        setFailed(true)
      } finally {
        setLoading(false)
      }
    },
    [filter],
  )

  useEffect(() => {
    setPage(1)
    void loadList(1)
  }, [loadList, reloadKey])

  const loadMore = async () => {
    const next = page + 1
    await loadList(next, true)
    setPage(next)
  }

  const onResolve = async (wq: WrongQuestion) => {
    setResolving(wq.questionId)
    try {
      const res = await fetchApi(`/api/exam/wrong-questions/${wq.questionId}/resolve`, {
        method: 'PUT',
      })
      if (!res.success) throw new Error(res.error)
      appAlert(t('wrongQuestions.markSuccess'))
      setReloadKey((k) => k + 1)
    } catch {
      appAlert(t('common.error'), t('wrongQuestions.markFailed'))
    } finally {
      setResolving(null)
    }
  }

  const onExplain = async (wq: WrongQuestion) => {
    setExplaining(wq.questionId)
    try {
      const res = await fetchApi<{ explanation: string; cached: boolean }>(
        `/api/exam/wrong-questions/${wq.questionId}/explain`,
        { method: 'POST' },
      )
      if (!res.success) throw new Error(res.error)
      setExplanation({
        title: wq.questionTitle || wq.paperTitle || wq.questionId,
        text: res.data?.explanation ?? '',
      })
    } catch {
      appAlert(t('common.error'), t('wrongQuestions.explainFailed'))
    } finally {
      setExplaining(null)
    }
  }

  const styles = makeStyles()

  const statCards = [
    { key: 'total', label: t('wrongQuestions.statsTotal'), value: stats?.total ?? 0 },
    {
      key: 'unresolved',
      label: t('wrongQuestions.statsUnresolved'),
      value: stats?.unresolved ?? 0,
    },
    { key: 'resolved', label: t('wrongQuestions.statsResolved'), value: stats?.resolved ?? 0 },
  ]

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('wrongQuestions.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <View style={styles.header}>
        <View style={styles.statRow}>
          {statCards.map((c) => (
            <View key={c.key} style={styles.statCard}>
              <Text style={styles.statLabel}>{c.label}</Text>
              <Text style={styles.statValue}>{c.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.filterRow}>
          {(['all', 'unresolved', 'resolved'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipOn]}
              onPress={() => setFilter(f)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextOn]}>
                {f === 'all'
                  ? t('wrongQuestions.filterAll')
                  : f === 'unresolved'
                    ? t('wrongQuestions.filterUnresolved')
                    : t('wrongQuestions.filterResolved')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listBody}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.stateBox} color={tokens.text.tertiary} />
          ) : failed ? (
            <View style={styles.stateBox}>
              <Text style={styles.errorText}>{t('wrongQuestions.loadFailed')}</Text>
              <TouchableOpacity onPress={() => setReloadKey((k) => k + 1)} activeOpacity={0.7}>
                <Text style={styles.retry}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.stateBox}>
              <FileText size={28} color={tokens.text.tertiary} />
              <Text style={styles.muted}>{t('wrongQuestions.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.itemHead}>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.questionTitle || item.questionId.slice(0, 8)}
              </Text>
              <View style={styles.badge}>
                <Text style={[styles.badgeText, item.isMastered && styles.badgeTextOk]}>
                  {item.isMastered
                    ? t('wrongQuestions.filterResolved')
                    : t('wrongQuestions.filterUnresolved')}
                </Text>
              </View>
            </View>
            <Text style={styles.meta}>
              {item.paperTitle ?? '—'} ·{' '}
              {t('wrongQuestions.wrongCount', { count: item.wrongCount })} ·{' '}
              {t('wrongQuestions.time')}: {fmt(item.createdAt)}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => void onExplain(item)}
                disabled={explaining !== null}
                activeOpacity={0.7}
              >
                {explaining === item.questionId ? (
                  <ActivityIndicator size="small" color={tokens.text.secondary} />
                ) : (
                  <Sparkles size={14} color={tokens.text.secondary} />
                )}
                <Text style={styles.actionText}>{t('wrongQuestions.aiExplain')}</Text>
              </TouchableOpacity>
              {!item.isMastered ? (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => void onResolve(item)}
                  disabled={resolving !== null}
                  activeOpacity={0.7}
                >
                  {resolving === item.questionId ? (
                    <ActivityIndicator size="small" color={tokens.text.secondary} />
                  ) : (
                    <CheckCircle2 size={14} color={tokens.text.secondary} />
                  )}
                  <Text style={styles.actionText}>{t('wrongQuestions.markAsResolved')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}
        ListFooterComponent={
          !loading && list.length < total ? (
            <TouchableOpacity
              style={styles.moreBtn}
              onPress={() => void loadMore()}
              activeOpacity={0.7}
            >
              <Text style={styles.moreText}>
                {t('wrongQuestions.loadMore')} ({list.length}/{total})
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <Modal
        visible={explanation !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setExplanation(null)}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.mask} onPress={() => setExplanation(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Sparkles size={16} color={tokens.text.primary} />
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {t('wrongQuestions.aiExplain')} · {explanation?.title}
              </Text>
              <Pressable onPress={() => setExplanation(null)} hitSlop={8}>
                <X size={18} color={tokens.text.secondary} />
              </Pressable>
            </View>
            <Text style={styles.explainText}>{explanation?.text}</Text>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    header: { paddingHorizontal: 12, paddingTop: 8, gap: 8 },
    statRow: { flexDirection: 'row', gap: 8 },
    statCard: {
      flex: 1,
      padding: 12,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.light,
      gap: 2,
    },
    statLabel: { fontSize: 11, color: tokens.text.tertiary },
    statValue: { fontSize: 20, fontWeight: '700', color: tokens.text.primary },
    filterRow: { flexDirection: 'row', gap: 8 },
    chip: {
      paddingHorizontal: 12,
      height: 30,
      justifyContent: 'center',
      borderRadius: rnRadiusFor.chip,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.light,
    },
    chipOn: { backgroundColor: tokens.brand.cta, borderColor: tokens.brand.cta },
    chipText: { fontSize: 12, color: tokens.text.secondary },
    chipTextOn: { color: tokens.brand.ctaForeground, fontWeight: '600' },
    listBody: { padding: 12, gap: 10, paddingBottom: 32 },
    card: {
      padding: 16,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.light,
      gap: 6,
    },
    itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    itemTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: tokens.text.primary,
      lineHeight: 20,
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: rnRadius.xs,
      backgroundColor: tokens.surface.muted,
    },
    badgeText: { fontSize: 11, color: tokens.text.tertiary },
    badgeTextOk: { color: tokens.success.DEFAULT },
    meta: { fontSize: 12, color: tokens.text.secondary, lineHeight: 18 },
    actions: { flexDirection: 'row', gap: 16, paddingTop: 4 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
    actionText: { fontSize: 12, fontWeight: '600', color: tokens.text.secondary },
    stateBox: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 48 },
    muted: { fontSize: 13, color: tokens.text.secondary },
    errorText: { fontSize: 13, color: tokens.danger.DEFAULT },
    retry: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    moreBtn: {
      height: 40,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    moreText: { fontSize: 13, color: tokens.text.primary },
    overlay: { flex: 1, justifyContent: 'flex-end' },
    mask: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      maxHeight: '70%',
      padding: 16,
      gap: 10,
      borderTopLeftRadius: rnRadius.xl,
      borderTopRightRadius: rnRadius.xl,
      backgroundColor: tokens.surface.light,
    },
    sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sheetTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: tokens.text.primary },
    explainText: { fontSize: 14, lineHeight: 22, color: tokens.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
