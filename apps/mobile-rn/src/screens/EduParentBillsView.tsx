// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 家长端「孩子账单」聚合视图(G-26 ③,mobile-rn 端)。
 *
 * 消费的是家长端点 `GET /api/edu-ai-management/parent/children/:childId/bills`
 * ——**不是** `/my-bills`:后者的身份是"学员本人"(token 主体查自己的报名),
 * 家长账号调它拿到的是家长自己作为 studentId 的报名(通常为空),结构上答不了
 * "我几个孩子各欠多少"。两个端点喂的都是同一份账目出口 `loadEnrollmentLedger`。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { fetchApi } from '@ihui/api-client'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '@ihui/rn-app'
import { rnSpacing } from '@ihui/design-tokens'
import { useI18n } from '../i18n'
import {
  aggregateParentBills,
  sumParentBills,
  type ParentBillChildRef,
  type ParentBillFetch,
  type ParentBillGroup,
  type ParentBillItem,
} from '../lib/edu-parent-bills'
import { EduParentBillsCard } from './EduParentBillsCard'
import { EduParentStateView, createParentStyles } from './EduParentUi'

interface Props {
  colorScheme: AppThemeMode
  childRefs: ParentBillChildRef[]
  onOpenChild: (studentId: string) => void
}

const BILLS_PATH = (studentId: string) =>
  `/api/edu-ai-management/parent/children/${studentId}/bills`

/**
 * 先按孩子分组取数,再一孩子一卡展示;失败的孩子保留卡片并点名原因
 * ——不拿 0 冒充"没欠费"(AGENTS §0.3)。
 */
export function EduParentBillsView({ colorScheme, childRefs, onOpenChild }: Props) {
  const { t, locale } = useI18n()
  const tk = getTokens(colorScheme)
  const styles = createParentStyles(tk)
  const own = createOwnStyles(tk)
  const [groups, setGroups] = useState<ParentBillGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fmtDate = useCallback(
    (iso: string | null) => {
      if (!iso) return '—'
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return '—'
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
    },
    [locale],
  )

  const load = useCallback(async () => {
    setError(null)
    try {
      const results = await Promise.all(
        childRefs.map(async (child): Promise<ParentBillFetch> => {
          try {
            const res = await fetchApi<{ bills: ParentBillItem[] }>(BILLS_PATH(child.studentId))
            if (!res.success) {
              return { studentId: child.studentId, failed: res.error || 'request failed' }
            }
            return { studentId: child.studentId, bills: res.data?.bills ?? [] }
          } catch (e) {
            return {
              studentId: child.studentId,
              failed: e instanceof Error ? e.message : 'request failed',
            }
          }
        }),
      )
      setGroups(aggregateParentBills(childRefs, results))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    }
  }, [childRefs])

  const retry = useCallback(() => {
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load().finally(() => setRefreshing(false))
  }, [load])

  if (loading && groups.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.brand.cta} />
      </View>
    )
  }

  if (error) {
    return (
      <EduParentStateView
        t={t}
        colorScheme={colorScheme}
        message={error}
        onRetry={retry}
        tone="danger"
      />
    )
  }

  const totals = sumParentBills(groups)
  const allEmpty =
    childRefs.length === 0 ||
    (groups.every((g) => !g.failed && g.termCount === 0) && totals.failedCount === 0)

  if (allEmpty) {
    return <EduParentStateView t={t} colorScheme={colorScheme} message={t('common.empty')} />
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.body}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('eduChildBills.arrears')}</Text>
          <Text style={own.summaryValue}>{`¥${totals.arrears}`}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('eduChildBills.nextDue')}</Text>
          <Text style={styles.rowValue}>{fmtDate(totals.nextDueDate)}</Text>
        </View>
        {totals.failedCount > 0 ? (
          <Text style={styles.dangerNote}>
            {`${t('common.loadFailed')} × ${totals.failedCount}`}
          </Text>
        ) : null}
      </View>

      {groups.map((group) => (
        <EduParentBillsCard
          key={group.studentId}
          t={t}
          colorScheme={colorScheme}
          group={group}
          fmtDate={fmtDate}
          onPress={() => onOpenChild(group.studentId)}
        />
      ))}
    </ScrollView>
  )
}

/** 汇总条上的总欠费是整页最大号读数,单独一档(仍 flexShrink: 0,守门 241) */
function createOwnStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    summaryValue: {
      flexShrink: 0,
      fontSize: 18,
      fontWeight: '700',
      color: tk.text.primary,
      fontVariant: ['tabular-nums'],
      paddingVertical: rnSpacing.xs,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
