// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CouponItem, CouponScreenProps, CouponStatus } from '../../types'

import { rnRadius } from '@ihui/design-tokens'
// G-815963:未知枚举档的唯一兜底出口(值档导入)。
import { coerceKnownOr } from '@ihui/types'
import { BackChevron } from '../../components/BackChevron'

/** 优惠券/Props 类型 re-export(单一来源 @ihui/types) */
export type { CouponItem, CouponScreenProps, CouponStatus }

/**
 * G-815966:展示域以 `as const` 元组闭合。
 *
 * 为什么另立一张而不用 `@ihui/types` 的 `CouponStatus`:那个类型写成
 * `'available' | 'used' | 'expired' | string`(app.ts:1408)—— 含 `| string` 的开放联合
 * 会让 `Record<CouponStatus, X>` 退化成 `Record<string, X>`,新增一档漏配展示**编译层完全不红**,
 * 于是本站点原先只能靠 `item.status as CouponStatus` + `!` 断言兜着。
 * 收窄那个开放联合属全端契约决策(动它要审所有消费方),不在本票射程;这里先按闭合展示域收口,
 * 开放值一律经 `coerceKnownOr` 收到终态档 'expired'(不可用、只读)再查表。
 */
const COUPON_DISPLAY_STATUSES = ['available', 'used', 'expired'] as const
export type CouponDisplayStatus = (typeof COUPON_DISPLAY_STATUSES)[number]
export { COUPON_DISPLAY_STATUSES }

/** 未知/未来档的兜底档:已过期 = 终态且不可使用(不产生副作用),不得兜到 available(可用态) */
export const COUPON_READONLY_FALLBACK = 'expired' as const satisfies CouponDisplayStatus

const TABS = COUPON_DISPLAY_STATUSES

/** 完备展示表:以闭合联合为键,漏一档即 TS 错误(旧形态是 Record<开放 CouponStatus, string>) */
const TAB_KEYS: Record<CouponDisplayStatus, string> = {
  available: 'coupon.available',
  used: 'coupon.used',
  expired: 'coupon.expired',
}

/** 状态→底色同为完备表,不再用「兜到 danger」的 if 链 */
const TAB_TONES: Record<CouponDisplayStatus, 'brand' | 'tertiary' | 'danger'> = {
  available: 'brand',
  used: 'tertiary',
  expired: 'danger',
}

/** 读侧收窄:合法值逐字不变,未知值兜到终态档 */
export function resolveCouponDisplayStatus(raw: unknown): CouponDisplayStatus {
  return coerceKnownOr(raw, COUPON_DISPLAY_STATUSES, COUPON_READONLY_FALLBACK)
}

/**
 * 优惠券列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header + tab 切换栏 + 横向布局优惠券卡片 + 下拉刷新。
 * 平台特定(导航 / API 调用 / tab 切换拉取 / 日期格式化)由 wrapper 通过 props 注入。
 */
export function CouponScreen({
  t,
  items,
  activeTab,
  onSelectTab,
  loading,
  refreshing,
  error,
  onRefresh,
  onBack,
  colorScheme = 'light',
}: CouponScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  // 底色取自完备表 TAB_TONES(以闭合联合为键),不再是「不是 available/used 就 danger」的隐式兜底
  const statusColor = (status: CouponDisplayStatus) => {
    const tone = TAB_TONES[status]
    return tone === 'brand'
      ? tk.brand.DEFAULT
      : tone === 'tertiary'
        ? tk.text.tertiary
        : tk.danger.DEFAULT
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron
          onPress={onBack}
          label={t('common.back')}
          colorScheme={colorScheme}
          style={styles.backBtn}
        />
        <Text style={styles.title}>{t('coupon.title')}</Text>
        <Text style={styles.subtitle}>{t('coupon.subtitle')}</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((s) => {
          const active = s === activeTab
          return (
            <TouchableOpacity
              key={s}
              onPress={() => onSelectTab(s)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t(TAB_KEYS[s])}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.retryText}>{t('coupon.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList<CouponItem>
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('coupon.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            // G-815963:读侧收窄,不再 `as CouponStatus` 直转 + `!` 断言(那等于对未知值放行)
            const status = resolveCouponDisplayStatus(item.status)
            return (
              <View style={styles.card}>
                <View style={styles.cardLeft}>
                  <Text style={styles.amountText}>¥{item.amount}</Text>
                  <Text style={styles.minText}>
                    {t('coupon.minSpend', { amount: item.minSpend })}
                  </Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.validText}>
                    {t('coupon.validUntil')}: {item.validUntil}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(status) }]}>
                    <Text style={styles.statusText}>{t(TAB_KEYS[status])}</Text>
                  </View>
                </View>
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 10, paddingBottom: 8 },
    backBtn: { marginBottom: 8 },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    tabs: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
    tab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.card,
    },
    tabActive: { backgroundColor: tk.brand.cta },
    tabText: { fontSize: 14, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light },
    errorBar: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT },
    retryText: { fontSize: 14, color: tk.success.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 32 },
    emptyText: { fontSize: 14, color: tk.text.tertiary, marginTop: 8 },
    listBody: { gap: 10, padding: 10, paddingBottom: 32 },
    card: {
      flexDirection: 'row',
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      overflow: 'hidden',
      backgroundColor: tk.surface.light,
    },
    cardLeft: {
      width: 96,
      padding: 16,
      backgroundColor: tk.success.light,
      alignItems: 'center',
      justifyContent: 'center',
    },
    amountText: { fontSize: 22, fontWeight: '700', color: tk.success.DEFAULT },
    minText: { marginTop: 8, fontSize: 11, color: tk.text.secondary, textAlign: 'center' },
    cardRight: { flex: 1, padding: 12 },
    cardName: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    validText: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
    statusBadge: {
      alignSelf: 'flex-start',
      marginTop: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
    },
    statusText: { fontSize: 11, color: tk.surface.light },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
