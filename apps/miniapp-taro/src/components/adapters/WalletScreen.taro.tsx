// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 @tarojs/components 的 View/Text/ScrollView 组件,不适合共享层
import { useTt } from '@/i18n'
import { View, Text, ScrollView } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { getRnTokens, type RnThemeMode, type RnThemeTokens } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'
import type { TFunction, WalletScreenProps } from '@ihui/types'

/** 钱包/Props 类型 re-export(单一来源 @ihui/types) */
export type { WalletBalance, WalletScreenProps } from '@ihui/types'

/** 卡片 tone:主色(primary)/ 次色(muted)区分,对齐 RN 源端 4 卡片配色 */
type CardTone = 'primary' | 'muted'

interface WalletCard {
  label: string
  value: number
  tone: CardTone
}

/**
 * Taro 适配层:WalletScreen
 *
 * 平台特有:依赖 @tarojs/components 的 View/Text/ScrollView 组件,不适合共享层。
 *
 * 复用 packages/app/src/features/wallet/WalletScreen 的 props 契约 + 4 金额卡片状态机 +
 * 充值/提现按钮 + 下拉刷新逻辑,仅替换平台元素:
 * - `div`/`span`/`TouchableOpacity` → `View`/`Text`
 * - `onPress` → `onTap`
 * - RN `ScrollView refreshControl` → Taro `ScrollView refresherEnabled + refresherTriggered`
 * - RN `StyleSheet.create` → CSSProperties 独立函数(避免 style 联合类型)
 * - px → rpx 单位换算(1px = 2rpx,750 设计稿基准)
 *
 * 颜色通过 `getRnTokens(colorScheme)` 共享注入,保持与 RN 端主题一致。
 *
 * i18n 三级降级:`t` prop → `useTt()` I18nContext → 硬编码中文 fallback。
 * WalletScreenProps.t 为必填(契约约束),useTt 作防御性兜底,tr() 对 i18n miss 降级到硬编码。
 */
export function WalletScreen({
  t: tProp,
  balance,
  loading,
  error,
  onRefresh,
  onAction,
  onBack,
  colorScheme,
}: WalletScreenProps) {
  const { resolved: appTheme } = useAppTheme()
  const effectiveScheme: RnThemeMode = colorScheme ?? appTheme
  const tk = getRnTokens(effectiveScheme)
  const tt = useTt()

  // i18n 三级降级:prop t > I18nContext tt > 硬编码中文(WalletScreenProps.t 必填,useTt 防御性兜底)
  const tFn: TFunction =
    tProp ??
    ((key, options) => tt(key, key, options as Record<string, string | number> | undefined))
  /** t(key) 未命中(返回 key 原值)时降级到硬编码 fallback */
  const tr = (key: string, fallback: string): string => {
    const v = tFn(key)
    return v === key ? fallback : v
  }

  const cards: WalletCard[] = balance
    ? [
        { label: tr('wallet.balance', '余额'), value: balance.balance, tone: 'primary' },
        { label: tr('wallet.frozen', '冻结'), value: balance.frozenBalance, tone: 'muted' },
        {
          label: tr('wallet.totalRecharge', '累计充值'),
          value: balance.totalRecharge,
          tone: 'primary',
        },
        {
          label: tr('wallet.totalWithdraw', '累计提现'),
          value: balance.totalWithdraw,
          tone: 'muted',
        },
      ]
    : []

  const titleText = tr('wallet.title', '我的钱包')
  const backText = tr('common.back', '返回')
  const loadingText = tr('common.loading', '加载中...')
  const loadFailedText = tr('wallet.loadFailed', '加载失败')
  const rechargeText = tr('wallet.recharge', '充值')
  const withdrawText = tr('wallet.withdraw', '提现')

  return (
    <View style={viewStyles.container(tk)}>
      <View style={viewStyles.header(tk)}>
        <View style={viewStyles.backBtn()} onTap={onBack} hoverClass="opacity-60">
          <Text style={textStyles.backText(tk)}>{backText}</Text>
        </View>
        <Text style={textStyles.title(tk)}>{titleText}</Text>
      </View>

      {error ? <Text style={textStyles.errorText(tk)}>{error}</Text> : null}

      <ScrollView
        scrollY
        refresherEnabled
        refresherTriggered={loading && !!balance}
        onRefresherRefresh={onRefresh}
        style={viewStyles.scrollBody(tk)}
      >
        <View style={viewStyles.bodyInner(tk)}>
          {loading && !balance ? (
            <View style={viewStyles.center()}>
              <Text style={textStyles.muted(tk)}>{loadingText}</Text>
            </View>
          ) : cards.length === 0 ? (
            <View style={viewStyles.center()}>
              <Text style={textStyles.muted(tk)}>{loadFailedText}</Text>
            </View>
          ) : (
            cards.map((c) => (
              <View key={c.label} style={viewStyles.card(tk)}>
                <Text style={textStyles.cardLabel(tk)}>{c.label}</Text>
                <Text style={textStyles.cardValue(tk, c.tone === 'muted')}>
                  ¥ {c.value.toFixed(2)}
                </Text>
              </View>
            ))
          )}

          {onAction && balance ? (
            <View style={viewStyles.actions()}>
              <View
                style={viewStyles.rechargeBtn(tk)}
                onTap={() => onAction('recharge')}
                hoverClass="opacity-60"
              >
                <Text style={textStyles.rechargeBtnText(tk)}>{rechargeText}</Text>
              </View>
              <View
                style={viewStyles.withdrawBtn(tk)}
                onTap={() => onAction('withdraw')}
                hoverClass="opacity-60"
              >
                <Text style={textStyles.withdrawBtnText(tk)}>{withdrawText}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  )
}

// ===== 样式(view/text 分组,独立函数返回 CSSProperties,避免 style 联合类型) =====

/** Taro rpx 单位换算(1px = 2rpx,750 设计稿基准,与 miniapp-taro 全局风格一致) */
const toRpx = (px: number): string => `${px * 2}rpx`

const viewStyles = {
  container: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: tk.surface.bg,
  }),
  header: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    // 对齐 RN paddingHorizontal 10 / paddingVertical 12 (dp→rpx 1:2)
    paddingLeft: toRpx(10),
    paddingRight: toRpx(10),
    paddingTop: toRpx(12),
    paddingBottom: toRpx(12),
    backgroundColor: tk.surface.bg,
  }),
  backBtn: (): CSSProperties => ({
    // 对齐 RN hitSlop 8 (dp→rpx 1:2)
    paddingLeft: toRpx(8),
    paddingRight: toRpx(8),
    paddingTop: toRpx(8),
    paddingBottom: toRpx(8),
    marginRight: toRpx(12),
  }),
  scrollBody: (tk: RnThemeTokens): CSSProperties => ({
    flex: 1,
    backgroundColor: tk.surface.bg,
  }),
  bodyInner: (tk: RnThemeTokens): CSSProperties => ({
    // 对齐 RN body padding 10 (dp→rpx 1:2)
    paddingLeft: toRpx(10),
    paddingRight: toRpx(10),
    paddingTop: toRpx(10),
    paddingBottom: toRpx(10),
    backgroundColor: tk.surface.bg,
  }),
  center: (): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    paddingTop: toRpx(48),
    paddingBottom: toRpx(48),
  }),
  card: (tk: RnThemeTokens): CSSProperties => ({
    // 对齐 RN card padding 12 / borderRadius 12 / marginBottom 12 (dp→rpx 1:2)
    paddingLeft: toRpx(12),
    paddingRight: toRpx(12),
    paddingTop: toRpx(12),
    paddingBottom: toRpx(12),
    borderRadius: toRpx(12),
    border: `1px solid ${tk.border.light}`,
    marginBottom: toRpx(12),
    backgroundColor: tk.surface.light,
  }),
  actions: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    marginTop: toRpx(8),
  }),
  rechargeBtn: (tk: RnThemeTokens): CSSProperties => ({
    flex: 1,
    // 对齐 RN rechargeBtn height 50 / borderRadius 12 / brand 底 (dp→rpx 1:2)
    height: toRpx(50),
    borderRadius: toRpx(12),
    backgroundColor: tk.brand.DEFAULT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: toRpx(6),
  }),
  withdrawBtn: (tk: RnThemeTokens): CSSProperties => ({
    flex: 1,
    // 对齐 RN withdrawBtn height 44 / borderRadius 12 (dp→rpx 1:2)
    height: toRpx(44),
    borderRadius: toRpx(12),
    border: `1px solid ${tk.border.light}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tk.surface.light,
    marginLeft: toRpx(6),
  }),
}

const textStyles = {
  backText: (tk: RnThemeTokens): CSSProperties => ({
    // 对齐 RN backText fontSize 16 (dp→rpx 1:2)
    fontSize: toRpx(16),
    color: tk.text.medium,
  }),
  title: (tk: RnThemeTokens): CSSProperties => ({
    // 对齐 RN title fontSize 20 / fontWeight 600 (dp→rpx 1:2)
    fontSize: toRpx(20),
    fontWeight: 600,
    color: tk.text.primary,
  }),
  errorText: (tk: RnThemeTokens): CSSProperties => ({
    // 对齐 RN errorText paddingHorizontal 10 / fontSize 14 (dp→rpx 1:2)
    paddingLeft: toRpx(10),
    paddingRight: toRpx(10),
    fontSize: toRpx(14),
    color: tk.danger.DEFAULT,
  }),
  muted: (tk: RnThemeTokens): CSSProperties => ({
    // 对齐 RN muted fontSize 14 (dp→rpx 1:2)
    fontSize: toRpx(14),
    color: tk.text.secondary,
  }),
  cardLabel: (tk: RnThemeTokens): CSSProperties => ({
    // 对齐 RN cardLabel fontSize 14 (dp→rpx 1:2)
    fontSize: toRpx(14),
    color: tk.text.tertiary,
  }),
  cardValue: (tk: RnThemeTokens, muted: boolean): CSSProperties => ({
    // 对齐 RN cardValue marginTop 8 / fontSize 22 / fontWeight 700 (dp→rpx 1:2)
    marginTop: toRpx(8),
    fontSize: toRpx(22),
    fontWeight: 700,
    color: muted ? tk.text.secondary : tk.text.primary,
  }),
  rechargeBtnText: (tk: RnThemeTokens): CSSProperties => ({
    // 对齐 RN rechargeBtnText fontSize 16 / fontWeight 600 (dp→rpx 1:2)
    fontSize: toRpx(16),
    fontWeight: 600,
    // surface.light = 对比白字(品牌色/成功色背景上的白字,对齐 RN tokens 语义)
    color: tk.surface.light,
  }),
  withdrawBtnText: (tk: RnThemeTokens): CSSProperties => ({
    // 对齐 RN withdrawBtnText fontSize 16 / fontWeight 600 (dp→rpx 1:2)
    fontSize: toRpx(16),
    fontWeight: 600,
    color: tk.text.primary,
  }),
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
