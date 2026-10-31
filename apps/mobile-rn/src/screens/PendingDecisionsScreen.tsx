// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// E1 审批收件箱增强(2026-10-30 立):移动端「我的待决策」收件箱屏。
//
// 数据源 D193 聚合端点:listPendingDecisions() → { items: PendingDecisionItem[], total }
// (packages/api-client/src/endpoints/chat.ts,与 Web NotificationCenter 的
// pendingDecisions 区块同一契约:条目 = summary + 类型标签 + createdAt)。
// 交互:点条目深链回源会话(复用既有基建 navigation.navigate('Chat', { conversationId }),
// 与 ConversationImportScreen 同一条「不新造深链」口径,threadId 即会话 id)。
// 超时提醒:createdAt 距今超过 30 分钟 → 醒目「超时未处理」标记(纯前端计算,不新增后端)。
// 落点说明:共享通知屏(packages/app)无头部插槽且本车道禁改,故收件箱落独立屏 + 设置入口。
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ListTodo } from 'lucide-react-native'
import { listPendingDecisions, type PendingDecisionItem } from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 超时未审阈值:30 分钟(产品拍板值;判据导出供测试直测) */
export const PENDING_DECISION_TIMEOUT_MS = 30 * 60 * 1000

/** createdAt 距今是否已超过阈值;无效/缺失时间一律不算超时 */
export function isPendingDecisionOverdue(
  createdAt: string | null,
  now: number = Date.now(),
): boolean {
  if (!createdAt) return false
  const t0 = new Date(createdAt).getTime()
  if (Number.isNaN(t0)) return false
  return now - t0 > PENDING_DECISION_TIMEOUT_MS
}

/** 类型 → i18n 键(未知类型兜底回原文,与 Web decisionTypeLabel 同口径) */
function typeKey(type: string): string {
  if (type === 'permissions') return 'pendingDecisions.typePermissions'
  if (type === 'elicitation') return 'pendingDecisions.typeElicitation'
  if (type === 'tool_approval') return 'pendingDecisions.typeToolApproval'
  return ''
}

function fmt(iso: string | null, locale: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export default function PendingDecisionsScreen() {
  const { t, locale } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<PendingDecisionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true)
      setError(null)
      try {
        const res = await listPendingDecisions()
        if (!res.success) setError(res.error || t('pendingDecisions.loadFailed'))
        else setItems(res.data?.items ?? [])
      } catch {
        setError(t('pendingDecisions.loadFailed'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  // 深链回源:threadId 即会话 id;缺失(孤儿决策)时不跳,如实提示
  const openSource = (item: PendingDecisionItem) => {
    if (!item.threadId) {
      appAlert(t('pendingDecisions.title'), t('pendingDecisions.noSource'))
      return
    }
    navigation.navigate('Chat', { conversationId: item.threadId })
  }

  const styles = makeStyles()
  const now = Date.now()

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('pendingDecisions.title')} onBack={() => navigation.goBack()} />
      </NavChrome>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              void load(true)
            }}
          />
        }
      >
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <ListTodo size={16} color={tokens.text.secondary} />
            <Text style={styles.cardTitle}>{t('pendingDecisions.sectionTitle')}</Text>
            {items.length > 0 ? (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{items.length}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.muted}>{t('pendingDecisions.hint')}</Text>

          {loading ? (
            <ActivityIndicator style={styles.loading} color={tokens.text.tertiary} />
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.error}>{error}</Text>
              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() => void load()}
                activeOpacity={0.7}
              >
                <Text style={styles.outlineText}>{t('pendingDecisions.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyTitle}>{t('pendingDecisions.empty')}</Text>
            </View>
          ) : (
            items.map((item) => {
              const overdue = isPendingDecisionOverdue(item.createdAt, now)
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.itemRow}
                  onPress={() => openSource(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemHead}>
                    <Text style={styles.itemSummary} numberOfLines={2}>
                      {item.summary || (typeKey(item.type) ? t(typeKey(item.type)) : item.type)}
                    </Text>
                    {overdue ? (
                      <View style={styles.overdueBadge}>
                        <Text style={styles.overdueText}>{t('pendingDecisions.overdue')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.itemMetaRow}>
                    <View style={styles.typeChip}>
                      <Text style={styles.typeChipText}>
                        {typeKey(item.type) ? t(typeKey(item.type)) : item.type}
                      </Text>
                    </View>
                    <Text style={styles.meta}>{fmt(item.createdAt, locale)}</Text>
                  </View>
                </TouchableOpacity>
              )
            })
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: rnSpacing.md, gap: rnSpacing.md, paddingBottom: rnSpacing['3xl'] },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: rnSpacing.sm,
    },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing['xs-loose'] },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tokens.text.primary },
    countBadge: {
      minWidth: 18,
      paddingHorizontal: 5,
      borderRadius: rnRadius.md,
      backgroundColor: tokens.brand.cta,
      alignItems: 'center',
    },
    countText: { fontSize: 10, fontWeight: '700', color: tokens.brand.ctaForeground },
    muted: { fontSize: 13, color: tokens.text.secondary, lineHeight: 19 },
    error: { fontSize: 13, color: tokens.danger.DEFAULT },
    loading: { paddingVertical: rnSpacing.lg },
    centerBox: { alignItems: 'center', gap: rnSpacing.sm, paddingVertical: rnSpacing.lg },
    emptyTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tokens.text.primary },
    outlineButton: {
      height: 36,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineText: { fontSize: rnType.body.size, color: tokens.text.primary },
    itemRow: {
      gap: rnSpacing['xs-loose'],
      paddingVertical: rnSpacing['sm-loose'],
      paddingHorizontal: rnSpacing['sm-loose'],
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.surface.bg,
    },
    itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing.sm },
    itemSummary: {
      flex: 1,
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    // 超时未审:红边 + 红底醒目(纯前端按 createdAt 距今 >30min 计算)
    overdueBadge: {
      paddingHorizontal: rnSpacing['xs-loose'],
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tokens.danger.DEFAULT,
      backgroundColor: tokens.surface.card,
    },
    overdueText: { fontSize: 10, fontWeight: '700', color: tokens.danger.DEFAULT },
    itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    typeChip: {
      paddingHorizontal: rnSpacing['xs-loose'],
      paddingVertical: 1,
      borderRadius: rnRadius.md,
      backgroundColor: tokens.surface.muted,
    },
    typeChipText: { fontSize: 10, color: tokens.text.secondary },
    meta: { fontSize: rnType.label.size, color: tokens.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
