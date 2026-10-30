// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
} from 'react-native'
import { Layers, Plus, Sparkles } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState } from '../../components/ScreenStates'

const NS = 'agentsMyPage'

/** 与 web 同取值集(apps/web/app/(main)/agents/my/page.tsx:37-43 STATUS_FILTERS) */
const STATUS_FILTERS = ['all', 'pending', 'published', 'rejected', 'offline'] as const

/** 与 web STATUS_FILTER_KEY 同表(page.tsx:46-52),值=本页 ns 下的键 */
const STATUS_FILTER_KEY: Record<string, string> = {
  all: 'statusAll',
  pending: 'statusPending',
  published: 'statusPublished',
  rejected: 'statusRejected',
  offline: 'statusOffline',
}

type BadgeTone = 'pending' | 'published' | 'rejected' | 'offline' | 'neutral'

/** 与 web STATUS_CLASS 同档(page.tsx:54-59 amber/emerald/destructive/muted → 令牌同名档) */
const STATUS_TONE: Record<string, BadgeTone> = {
  pending: 'pending',
  published: 'published',
  rejected: 'rejected',
  offline: 'offline',
}

export interface MyAgentRowView {
  agentId: string
  name: string
  /** web: description ?? t('noDescription')(page.tsx:182),空值文案由薄壳注入 */
  descText: string
  status: string
  /** 薄壳按 web 同 ns 取的状态文案(status 不在字典内时原样回落,page.tsx:175-177) */
  statusText: string
  /** web: isFree ? t('free') : `¥${price}`(page.tsx:191),格式化在薄壳 */
  priceText: string
  /** 薄壳按 web 同参 Intl(year/month/day 2-digit)格式化 updatedAt(page.tsx:79-87) */
  updatedText: string
}

export interface MyAgentsScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** web「创建」按钮目标 /agents/create(page.tsx:107);由薄壳接导航 */
  onCreate: () => void
  /** 非空即未登录门(与 web useAuthGate + AuthGatePrompt 同口径,page.tsx:131) */
  loginRequiredText: string
  loading: boolean
  error: string | null
  rows: MyAgentRowView[]
  filterValue: string
  onFilterChange: (value: string) => void
  onPressRow: (agentId: string) => void
  onRetry: () => void
  onRefresh: () => void
}

/**
 * 「我的智能体」共享屏 —— 承载 web /agents/my(GET /api/agents/my)。
 *
 * 与 web 的口径差(如实登记):web 是 min-[640px]/[1024px] 响应式三列卡片网格,
 * RN 落为单列卡片列表 + 下拉刷新,同端点同参数;筛选胶囊同五值集;登录门同义。
 * 平台无关:取数 / 时间格式化 / 登录态 / 导航由薄壳注入,本文件只管渲染与三态。
 */
export function MyAgentsScreen({
  t,
  colorScheme,
  onBack,
  onCreate,
  loginRequiredText,
  loading,
  error,
  rows,
  filterValue,
  onFilterChange,
  onPressRow,
  onRetry,
  onRefresh,
}: MyAgentsScreenProps) {
  const tk = getTokens(colorScheme)
  const { styles, badgeTone } = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <Layers size={18} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          </View>
          <Text style={styles.muted}>{t(`${NS}.subtitle`)}</Text>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={onCreate}>
          <Plus size={14} color={tk.surface.light} />
          <Text style={styles.createText}>{t(`${NS}.create`)}</Text>
        </TouchableOpacity>
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : (
        <>
          <View style={styles.filterRow}>
            {STATUS_FILTERS.map((value) => {
              const active = filterValue === value
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => onFilterChange(value)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {t(`${NS}.${STATUS_FILTER_KEY[value] ?? 'statusUnknown'}`)}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {loading ? (
            <View style={styles.centerBlock}>
              <Sparkles size={22} color={tk.text.tertiary} />
              <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
            </View>
          ) : error ? (
            <ErrorState
              message={error}
              retryLabel={t(`${NS}.retry`)}
              onRetry={onRetry}
              colorScheme={colorScheme}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={26} color={tk.text.tertiary} />}
              title={t(`${NS}.empty`)}
              colorScheme={colorScheme}
            />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => item.agentId}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              onRefresh={onRefresh}
              refreshing={false}
              renderItem={({ item }) => {
                const tone = STATUS_TONE[item.status] ?? 'neutral'
                return (
                  <TouchableOpacity style={styles.card} onPress={() => onPressRow(item.agentId)}>
                    <View style={styles.cardHead}>
                      <View style={styles.avatarBox}>
                        <Sparkles size={18} color={tk.text.secondary} />
                      </View>
                      <View style={styles.cardHeadText}>
                        <Text style={styles.name} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={[styles.badge, badgeTone[tone]]}>{item.statusText}</Text>
                      </View>
                    </View>
                    <Text style={styles.desc} numberOfLines={2}>
                      {item.descText}
                    </Text>
                    <View style={styles.cardFoot}>
                      <Text style={styles.price}>{item.priceText}</Text>
                      <Text style={styles.muted}>{item.updatedText}</Text>
                    </View>
                  </TouchableOpacity>
                )
              }}
            />
          )}
        </>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    muted: { marginTop: 2, fontSize: rnType.label.size, color: tk.text.secondary },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
    },
    createText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.surface.light },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
    },
    chip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    chipActive: { borderColor: tk.brand.DEFAULT, backgroundColor: tk.surface.card },
    chipText: { fontSize: rnType.label.size, color: tk.text.secondary },
    chipTextActive: { color: tk.brand.DEFAULT, fontWeight: '600' },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    list: { flex: 1, marginTop: rnSpacing.md },
    listContent: { paddingBottom: rnSpacing['2xl'] },
    card: {
      gap: rnSpacing.sm,
      marginBottom: rnSpacing.md,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing.md },
    avatarBox: {
      width: 40,
      height: 40,
      borderRadius: rnRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    cardHeadText: { flex: 1, gap: 4 },
    name: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      fontSize: rnType.caption.size,
      fontWeight: '500',
    },
    desc: { fontSize: rnType.caption.size, color: tk.text.secondary },
    cardFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    price: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
  })

  const badgeTone: Record<BadgeTone, TextStyle> = {
    pending: { backgroundColor: tk.warning.amberLight, color: tk.warning.amberText },
    published: { backgroundColor: tk.success.lightest, color: tk.success.deepText },
    rejected: { backgroundColor: tk.danger.light, color: tk.danger.DEFAULT },
    offline: { backgroundColor: tk.surface.muted, color: tk.text.secondary },
    neutral: { backgroundColor: tk.surface.muted, color: tk.text.secondary },
  }

  return { styles, badgeTone }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
