// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { ShoppingCart } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { rnRadius, rnSpacing, rnType, rnCssLight } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState } from '../../components/ScreenStates'

/**
 * 教育商城共享屏 —— 渲染真相源(web 基准 = apps/web/app/(main)/edu/shop/page.tsx)。
 *
 * 双 Tab:课程商品(封面/标题/讲师/课时/价格或免费,购买 CTA)· 我的订单
 * (标题/单号/金额/状态,取消确认模态)。分页 loadMore。
 *
 * 平台侧注入取数与副作用:GET /api/edu/courses、GET /api/edu/orders/my、
 * POST /api/edu/orders、POST /api/edu/orders/:id/cancel 全留在各端薄壳。
 */
export interface EduShopCourseView {
  id: string
  title: string
  coverImage?: string | null
  intro?: string | null
  price?: string | null
  originalPrice?: string | null
  isFree?: boolean
  lecturerName?: string | null
  lessonCount?: number | null
}

export interface EduShopOrderView {
  id: string
  orderNo: string
  targetTitle?: string | null
  quantity: number
  payAmount?: string | null
  status: string
  createdAt?: string | null
}

export interface EduShopScreenProps {
  t: (key: string, params?: Record<string, string | number>) => string
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  courses: EduShopCourseView[]
  coursesLoading: boolean
  coursesError: string | null
  hasMoreCourses: boolean
  onLoadMoreCourses: () => void
  onRetryCourses: () => void
  orders: EduShopOrderView[]
  ordersLoading: boolean
  ordersError: string | null
  hasMoreOrders: boolean
  onLoadMoreOrders: () => void
  onRetryOrders: () => void
  onBuy: (course: EduShopCourseView) => void
  onCancelOrder: (id: string) => void
  actionPending: boolean
  formatDate?: (iso: string | null) => string
  /** 订单状态显示词(薄壳注入 t('eduShop.status.<status>'),键缺失回退原值) */
  orderStatusLabel?: (status: string) => string
}

export function EduShopScreen({
  t,
  colorScheme = 'light',
  onBack,
  courses,
  coursesLoading,
  coursesError,
  hasMoreCourses,
  onLoadMoreCourses,
  onRetryCourses,
  orders,
  ordersLoading,
  ordersError,
  hasMoreOrders,
  onLoadMoreOrders,
  onRetryOrders,
  onBuy,
  onCancelOrder,
  actionPending,
  formatDate,
  orderStatusLabel,
}: EduShopScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [tab, setTab] = useState<'courses' | 'orders'>('courses')
  const [cancelTarget, setCancelTarget] = useState<EduShopOrderView | null>(null)
  const fmt = formatDate ?? ((iso: string | null) => iso ?? '')

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('eduShop.title')}</Text>
      </View>
      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setTab('courses')}
          style={[styles.tab, tab === 'courses' && styles.tabOn]}
          accessibilityRole="tab"
        >
          <Text style={tab === 'courses' ? styles.tabTextOn : styles.tabText}>
            {t('eduShop.courses')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('orders')}
          style={[styles.tab, tab === 'orders' && styles.tabOn]}
          accessibilityRole="tab"
        >
          <Text style={tab === 'orders' ? styles.tabTextOn : styles.tabText}>
            {t('eduShop.orders')}
          </Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {tab === 'courses' ? (
          coursesError ? (
            <ErrorState
              message={coursesError}
              onRetry={onRetryCourses}
              retryLabel={t('common.retry')}
              colorScheme={colorScheme}
            />
          ) : courses.length === 0 && !coursesLoading ? (
            <EmptyState glyph="◫" title={t('eduShop.emptyCourses')} colorScheme={colorScheme} />
          ) : (
            <View style={styles.list}>
              {courses.map((c) => (
                <View key={c.id} style={styles.card}>
                  {c.coverImage ? (
                    <Image source={{ uri: c.coverImage }} style={styles.cover} />
                  ) : null}
                  <View style={styles.cardBody}>
                    <Text style={styles.courseTitle}>{c.title}</Text>
                    {c.lecturerName || c.lessonCount ? (
                      <Text style={styles.meta}>
                        {[
                          c.lecturerName,
                          (c.lessonCount ?? 0) > 0
                            ? t('eduShop.lessons', { n: c.lessonCount ?? 0 })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                    <View style={styles.priceRow}>
                      {c.isFree ? (
                        <Text style={styles.freeBadge}>{t('eduShop.free')}</Text>
                      ) : (
                        <>
                          <Text style={styles.price}>{c.price ?? '—'}</Text>
                          {c.originalPrice ? (
                            <Text style={styles.originalPrice}>{c.originalPrice}</Text>
                          ) : null}
                        </>
                      )}
                      <Pressable
                        onPress={() => onBuy(c)}
                        disabled={actionPending}
                        style={({ pressed }) => [
                          styles.buyBtn,
                          pressed && styles.btnPressed,
                          actionPending && styles.btnDisabled,
                        ]}
                        accessibilityRole="button"
                      >
                        <ShoppingCart size={14} color={tk.brand.ctaForeground} />
                        <Text style={styles.buyBtnText}>{t('eduShop.buy')}</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
              {coursesLoading ? <ActivityIndicator color={tk.brand.cta} /> : null}
              {hasMoreCourses && !coursesLoading ? (
                <Pressable
                  onPress={onLoadMoreCourses}
                  style={({ pressed }) => [styles.moreBtn, pressed && styles.btnPressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.moreBtnText}>{t('eduShop.loadMore')}</Text>
                </Pressable>
              ) : null}
            </View>
          )
        ) : ordersError ? (
          <ErrorState
            message={ordersError}
            onRetry={onRetryOrders}
            retryLabel={t('common.retry')}
            colorScheme={colorScheme}
          />
        ) : orders.length === 0 && !ordersLoading ? (
          <EmptyState glyph="◍" title={t('eduShop.emptyOrders')} colorScheme={colorScheme} />
        ) : (
          <View style={styles.list}>
            {orders.map((o) => (
              <View key={o.id} style={styles.card}>
                <View style={styles.cardHeadRow}>
                  <Text style={styles.courseTitle} numberOfLines={1}>
                    {o.targetTitle ?? o.orderNo}
                  </Text>
                  <Text style={styles.statusBadge}>
                    {orderStatusLabel ? orderStatusLabel(o.status) : o.status}
                  </Text>
                </View>
                <Text style={styles.meta}>
                  {o.orderNo} · x{o.quantity} · {fmt(o.createdAt ?? null)}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{o.payAmount ?? '—'}</Text>
                  {o.status === 'pending' ? (
                    <Pressable
                      onPress={() => setCancelTarget(o)}
                      style={({ pressed }) => [styles.minorBtn, pressed && styles.btnPressed]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.minorBtnText}>{t('eduShop.cancelOrder')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
            {ordersLoading ? <ActivityIndicator color={tk.brand.cta} /> : null}
            {hasMoreOrders && !ordersLoading ? (
              <Pressable
                onPress={onLoadMoreOrders}
                style={({ pressed }) => [styles.moreBtn, pressed && styles.btnPressed]}
                accessibilityRole="button"
              >
                <Text style={styles.moreBtnText}>{t('eduShop.loadMore')}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={cancelTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('eduShop.cancelConfirmTitle')}</Text>
            <Text style={styles.modalDesc}>
              {t('eduShop.cancelConfirmDesc')} {cancelTarget?.targetTitle ?? ''}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setCancelTarget(null)}
                style={({ pressed }) => [styles.minorBtn, pressed && styles.btnPressed]}
                accessibilityRole="button"
              >
                <Text style={styles.minorBtnText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (cancelTarget) onCancelOrder(cancelTarget.id)
                  setCancelTarget(null)
                }}
                style={({ pressed }) => [styles.dangerBtn, pressed && styles.btnPressed]}
                accessibilityRole="button"
              >
                <Text style={styles.dangerBtnText}>{t('eduShop.cancelOrder')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { ...rnType.heading, color: tk.text.primary },
    tabRow: {
      flexDirection: 'row',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.lg,
      paddingBottom: rnSpacing.md,
    },
    tab: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    tabOn: { backgroundColor: tk.brand.cta, borderColor: tk.brand.cta },
    tabText: { fontSize: rnType.body.size, color: tk.text.secondary },
    tabTextOn: { fontSize: rnType.body.size, color: tk.brand.ctaForeground, fontWeight: '600' },
    body: { padding: rnSpacing.lg },
    list: { gap: rnSpacing.md },
    card: {
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      overflow: 'hidden',
      gap: rnSpacing.sm,
    },
    cover: { width: '100%', height: 140, backgroundColor: tk.surface.muted },
    cardBody: { padding: rnSpacing.lg, gap: rnSpacing.xs },
    cardHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    courseTitle: { flex: 1, ...rnType.title, color: tk.text.primary },
    meta: { fontSize: rnType.label.size, color: tk.text.tertiary },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: rnSpacing.xs,
    },
    price: { ...rnType.title, color: tk.brand.cta },
    originalPrice: {
      fontSize: rnType.label.size,
      color: tk.text.tertiary,
      textDecorationLine: 'line-through',
      marginLeft: rnSpacing.sm,
    },
    freeBadge: { ...rnType.body, color: tk.success.DEFAULT, fontWeight: '600' },
    statusBadge: { fontSize: rnType.label.size, color: tk.text.secondary },
    buyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      height: 32,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    buyBtnText: { fontSize: rnType.body.size, color: tk.brand.ctaForeground, fontWeight: '600' },
    moreBtn: {
      alignItems: 'center',
      height: 36,
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    moreBtnText: { fontSize: rnType.body.size, color: tk.text.primary },
    minorBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 36,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    minorBtnText: { fontSize: rnType.body.size, color: tk.text.primary },
    dangerBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 36,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.danger.DEFAULT,
    },
    dangerBtnText: { fontSize: rnType.body.size, color: tk.surface.light, fontWeight: '600' },
    modalOverlay: {
      flex: 1,
      backgroundColor: rnCssLight.black50,
      alignItems: 'center',
      justifyContent: 'center',
      padding: rnSpacing['2xl'],
    },
    modalCard: {
      width: '100%',
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.light,
      padding: rnSpacing.lg,
      gap: rnSpacing.md,
    },
    modalTitle: { ...rnType.title, color: tk.text.primary },
    modalDesc: { ...rnType.body, color: tk.text.secondary },
    modalActions: { flexDirection: 'row', gap: rnSpacing.sm, justifyContent: 'flex-end' },
    btnDisabled: { opacity: 0.6 },
    btnPressed: { opacity: 0.8 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
