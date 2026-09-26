// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { Check, Clock, X } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

import { rnRadius } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'

/** 支付结果三态(对齐 miniapp PayStatus) */
export type PayResultStatus = 'pending' | 'paid' | 'failed'

/** PayResultScreen props(注入式:wrapper 保留 getPaymentOrderDetail 轮询与导航) */
export interface PayResultScreenProps {
  t: TFunction
  /** 订单支付状态(pending/paid/failed) */
  status: PayResultStatus
  /** 订单金额(元),> 0 才展示 */
  amount: number
  /** 订单状态查询中(展示加载指示器) */
  checking: boolean
  /** pending 态「刷新」按钮回调(轮询逻辑由 wrapper 持有) */
  onRefresh: () => void
  /** 回首页 */
  onBackHome: () => void
  /** 查看订单列表 */
  onViewOrders: () => void
  /** 顶部返回 */
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

const STATUS_KEY: Record<PayResultStatus, string> = {
  pending: 'payResult.pending',
  paid: 'payResult.paid',
  failed: 'payResult.failed',
}

/**
 * PayResultScreen 支付结果(共享层) — props 注入式跨端组件
 *
 * 2026-09-15 承接 mobile-rn PayResultScreen(P0 统一支付结果页)1:1 迁移,
 * 对齐 miniapp pages/pay/result:
 * - 结构:NavBar 式头部(返回/居中标题)→ 状态圆标(pending=warning / paid=success /
 *   failed=danger)+ 状态文案 + 金额 + 查询指示器 → 动作区(出结果:回首页/查订单;pending:刷新)
 * - 平台无关:getPaymentOrderDetail 轮询、路由参数、导航由 wrapper 注入
 * - 样式:getTokens(colorScheme) 语义 token(零 hex);750 设计稿 rpx 值按 /2 转 dp
 * - i18n:沿用 payResult.*(mobile-rn i18n 既有 key);图标 lucide-react-native(无 emoji)
 */
export function PayResultScreen({
  t,
  status,
  amount,
  checking,
  onRefresh,
  onBackHome,
  onViewOrders,
  onBack,
  colorScheme = 'light',
}: PayResultScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const statusBg: Record<PayResultStatus, string> = {
    pending: tk.warning.amber,
    paid: tk.success.DEFAULT,
    failed: tk.danger.DEFAULT,
  }

  return (
    <View style={styles.container}>
      {/* 顶部导航行(对齐 RN NavBar:返回 + 居中标题) */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t('payResult.title')}
          </Text>
          <View style={styles.sidePlaceholder} />
        </View>
      </View>
      <View style={styles.body}>
        {/* 状态圆标(对齐 miniapp 160rpx 圆角图标位) */}
        <View style={[styles.statusIcon, { backgroundColor: statusBg[status] }]}>
          {status === 'paid' ? (
            <Check size={40} color={tk.surface.light} />
          ) : status === 'failed' ? (
            <X size={40} color={tk.surface.light} />
          ) : (
            <Clock size={40} color={tk.surface.light} />
          )}
        </View>
        <Text style={styles.statusText}>{t(STATUS_KEY[status])}</Text>
        {amount > 0 && <Text style={styles.amountText}>¥{amount.toFixed(2)}</Text>}
        {checking && <ActivityIndicator style={styles.checking} color={tk.text.secondary} />}
      </View>
      <View style={styles.actions}>
        {status !== 'pending' ? (
          <>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed ? styles.btnPressed : null]}
              onPress={onBackHome}
              accessibilityRole="button"
              accessibilityLabel={t('payResult.backHome')}
            >
              <Text style={styles.primaryText}>{t('payResult.backHome')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed ? styles.btnPressed : null]}
              onPress={onViewOrders}
              accessibilityRole="button"
              accessibilityLabel={t('payResult.viewOrders')}
            >
              <Text style={styles.secondaryText}>{t('payResult.viewOrders')}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed ? styles.btnPressed : null]}
            onPress={onRefresh}
            accessibilityRole="button"
            accessibilityLabel={t('payResult.refresh')}
          >
            <Text style={styles.primaryText}>{t('payResult.refresh')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

/**
 * 样式:750 设计稿 rpx 值 / 2 转 dp(共享层惯例,对齐 packages/app 其他迁移屏)。
 * 颜色全部走 AppThemeTokens 语义 token,零 hex。
 */
function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    /* 顶部导航行(对齐 NavBar:透明底、无下描边 ⇒ 透出 container 页面底色;状态栏区留白) */
    header: {
      // 状态栏区留白(对齐共享层 PaymentScreen 头部惯例)
      paddingHorizontal: 10,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 44,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
      color: tk.text.primary,
      textAlign: 'center',
    },
    sidePlaceholder: {
      width: 32,
    },
    body: {
      alignItems: 'center',
      paddingVertical: 60, // rpx(120)
    },
    statusIcon: {
      width: 80, // rpx(160)
      height: 80, // rpx(160)
      borderRadius: rnRadius.xl, // rpx(24)
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusText: {
      marginTop: 16, // rpx(32)
      fontSize: 18,
      fontWeight: '600',
      color: tk.text.primary,
    },
    amountText: {
      marginTop: 8, // rpx(16)
      fontSize: 20,
      fontWeight: '600',
      color: tk.danger.DEFAULT,
    },
    checking: {
      marginTop: 10, // rpx(20)
    },
    actions: {
      paddingHorizontal: 30, // rpx(60)
      gap: 16, // rpx(32)
    },
    primaryBtn: {
      height: 44, // rpx(88)
      borderRadius: rnRadius.lg, // rpx(16)
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtn: {
      height: 44, // rpx(88)
      borderRadius: rnRadius.lg, // rpx(16)
      backgroundColor: tk.surface.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPressed: {
      opacity: 0.85,
    },
    primaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.surface.light,
    },
    secondaryText: {
      fontSize: 15,
      color: tk.text.primary,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
