// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Wallet } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'tokenWalletPage'

/** opType 取值集(web 同表 apps/web/app/(main)/distribution/token/page.tsx:62-66) */
const OP_TYPE_OPTIONS = [0, 1, 2] as const

/** opType → 本页 ns 下的 i18n 键(web OP_TYPE_KEY 同表) */
const OP_TYPE_KEY: Record<number, string> = {
  0: 'flowRecharge',
  1: 'flowDeduct',
  2: 'flowExpire',
}

export interface TokenFlowRowView {
  id: string
  /** 薄壳按 opType 注入的文案(充值/扣减/过期) */
  typeText: string
  /** 数量(正值;符号由 positive 决定展示的 +/-) */
  quantity: number
  /** opType===0 即充值,web 同口径按正整数显示 + 号 */
  positive: boolean
  /** 变动后余额 */
  balanceAfter: number
  /** 薄壳按同参 Intl 格式化后的时间文本 */
  timeText: string
  /** 备注(空落 '-') */
  remarkText: string
}

export interface TokenWalletScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web useAuthGate + AuthGatePrompt 同口径) */
  loginRequiredText: string
  loading: boolean
  error: string | null
  balance: number
  rows: TokenFlowRowView[]
  total: number
  /** 'all' | '0' | '1' | '2' */
  opTypeValue: string
  onOpTypeChange: (value: string) => void
  loadingMore: boolean
  hasMore: boolean
  onEndReached: () => void
  onRefresh: () => void
}

/**
 * 代币钱包共享屏 —— 承载 web /distribution/token
 * (GET /api/finance/margin/balance + GET /api/finance/margin/flows)。
 *
 * 口径差(如实登记):web 是「余额卡 + 表格 + 上一页/下一页按钮」,RN 落为「余额卡 + 卡片行 +
 * 下拉刷新 + 触底续页」,同一端点同参数(page/limit/opType);五列表格在 RN 落为「标签—值」行,
 * 列文案与 opType 文案五语值逐字取 web distribution 命名空间。opType 语义色与 web 同源
 * (充值 opType===0 → emerald、其余 → red)。平台无关:取数/时间格式化/登录态判定/opType 文案
 * 全部由薄壳注入,本文件只管渲染与 loading/error/empty 三态。
 */
export function TokenWalletScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  balance,
  rows,
  total,
  opTypeValue,
  onOpTypeChange,
  loadingMore,
  hasMore,
  onEndReached,
  onRefresh,
}: TokenWalletScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleRow}>
          <Wallet size={20} color={tk.brand.DEFAULT} />
          <Text style={styles.title}>{t(`${NS}.title`)}</Text>
        </View>
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : (
        <>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>{t(`${NS}.tokenBalance`)}</Text>
            <Text style={styles.balanceValue}>{balance}</Text>
          </View>

          <View style={styles.flowsHead}>
            <Text style={styles.sectionTitle}>{t(`${NS}.tokenFlows`)}</Text>
            {total > 0 ? <Text style={styles.muted}>{t(`${NS}.totalOf`, { total })}</Text> : null}
          </View>

          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.chip, opTypeValue === 'all' && styles.chipActive]}
              onPress={() => onOpTypeChange('all')}
            >
              <Text style={[styles.chipText, opTypeValue === 'all' && styles.chipTextActive]}>
                {t(`${NS}.opTypeAll`)}
              </Text>
            </TouchableOpacity>
            {OP_TYPE_OPTIONS.map((value) => {
              const active = opTypeValue === String(value)
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => onOpTypeChange(String(value))}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {t(`${NS}.${OP_TYPE_KEY[value]}`)}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {loading ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
              <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
            </View>
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : rows.length === 0 ? (
            <View style={styles.centerBlock}>
              <Wallet size={30} color={tk.text.tertiary} />
              <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
            </View>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <View style={styles.rowHead}>
                    <Text style={styles.typeText}>{item.typeText}</Text>
                    <Text style={[styles.quantity, item.positive ? styles.pos : styles.neg]}>
                      {`${item.positive ? '+' : ''}${item.quantity}`}
                    </Text>
                  </View>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{t(`${NS}.flowBalance`)}</Text>
                    <Text style={styles.fieldValue}>{item.balanceAfter}</Text>
                  </View>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{t(`${NS}.flowTime`)}</Text>
                    <Text style={styles.fieldValue}>{item.timeText}</Text>
                  </View>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{t(`${NS}.flowRemark`)}</Text>
                    <Text style={styles.fieldValue} numberOfLines={2}>
                      {item.remarkText}
                    </Text>
                  </View>
                </View>
              )}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
              onEndReached={hasMore ? onEndReached : undefined}
              onEndReachedThreshold={0.4}
              ListFooterComponent={
                loadingMore ? <Text style={styles.footerMuted}>{t(`${NS}.loading`)}</Text> : null
              }
            />
          )}
        </>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm, flex: 1 },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    balanceCard: {
      marginTop: rnSpacing.md,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      gap: 2,
    },
    balanceLabel: { fontSize: rnType.label.size, color: tk.text.secondary },
    balanceValue: { fontSize: 26, fontWeight: '700', color: tk.text.primary },
    flowsHead: {
      marginTop: rnSpacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: { fontSize: rnType.strong.size, fontWeight: '600', color: tk.text.primary },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.sm,
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
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    error: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    list: { flex: 1, marginTop: rnSpacing.md },
    listContent: { paddingBottom: rnSpacing['2xl'] },
    row: {
      gap: rnSpacing.xs,
      marginBottom: rnSpacing.md,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    rowHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    typeText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    quantity: { fontSize: rnType.body.size, fontWeight: '600' },
    pos: { color: tk.success.DEFAULT },
    neg: { color: tk.danger.DEFAULT },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    fieldLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    fieldValue: { flex: 1, textAlign: 'right', fontSize: rnType.caption.size, color: tk.text.primary },
    footerMuted: {
      textAlign: 'center',
      paddingVertical: rnSpacing.md,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
