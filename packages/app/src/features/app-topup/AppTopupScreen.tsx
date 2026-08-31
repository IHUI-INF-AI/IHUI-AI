// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  Modal,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AppTopupScreenProps } from '../../types'

/** AppTopupScreen props re-export(单一来源 @ihui/types) */
export type { AppTopupScreenProps }

/**
 * 三档充值比例(每 1 元对应的智汇值,硬编码沿用原项目 top-up/index.vue
 * data 初始值:denomination 20000 / denominationVip 40000 / denominationOperate 80000,
 * 不做后台配置)。
 */
const TOPUP_TIERS = [
  { key: 'normal', label: '普通用户', tokens: 20000 },
  { key: 'vip', label: '会员', tokens: 40000 },
  { key: 'trader', label: '操盘手', tokens: 80000 },
] as const

/** 等价 @ihui/shared/utils/formatTokenValue(≥10000 → 'X.XX万'),共享层不依赖 shared 包,内联实现 */
function formatTokenValue(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(2)}亿`
  if (value >= 10000) return `${(value / 10000).toFixed(2)}万`
  return String(Math.floor(value))
}

export function AppTopupScreen({
  t,
  selectedId,
  customAmount,
  payMethod,
  balance,
  refreshing,
  introVisible,
  userTier,
  amountOptions,
  payMethods,
  onSelectAmount,
  onCustomAmountChange,
  onSelectPayMethod,
  onRefresh,
  onSubmit,
  onCloseIntro,
  onBack,
  colorScheme = 'light',
}: AppTopupScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const selectedOption = amountOptions.find((o) => o.id === selectedId)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>充值</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tk.text.tertiary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>账户余额</Text>
          <Text style={styles.balanceValue}>{'¥' + (balance / 100).toFixed(2)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>选择金额</Text>
          {/* 三档比例展示(对齐原项目 top-up/index.vue 的充值比例区,当前档位高亮) */}
          <View style={styles.rateBox}>
            <Text style={styles.rateTitle}>充值比例</Text>
            {TOPUP_TIERS.map((tier) => (
              <Text
                key={tier.key}
                style={[styles.rateItem, userTier === tier.key && styles.rateItemActive]}
              >
                {tier.label} 1元={formatTokenValue(tier.tokens)}智汇值
              </Text>
            ))}
          </View>
          <View style={styles.amountGrid}>
            {amountOptions.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.amountCard, selectedId === opt.id && styles.amountCardActive]}
                onPress={() => onSelectAmount(opt.id)}
              >
                <Text style={[styles.amountText, selectedId === opt.id && styles.amountTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.customInput}
            value={customAmount}
            onChangeText={onCustomAmountChange}
            placeholder="或输入自定义金额"
            placeholderTextColor={tk.text.tertiary}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>支付方式</Text>
          <View style={styles.payList}>
            {payMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[styles.payItem, payMethod === method.id && styles.payItemActive]}
                onPress={() => onSelectPayMethod(method.id)}
              >
                <Text style={[styles.payLabel, payMethod === method.id && styles.payLabelActive]}>
                  {method.label}
                </Text>
                {payMethod === method.id && <Text style={styles.payCheck}>{'✓'}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, !selectedOption && styles.submitBtnDisabled]}
          onPress={onSubmit}
          disabled={!selectedOption}
        >
          <Text style={styles.submitBtnText}>立即充值</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={introVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>充值说明</Text>
            <Text style={styles.modalBody}>
              充值金额将立即到账，可用于购买课程、服务等。如有问题请联系客服。
            </Text>
            <TouchableOpacity style={styles.modalClose} onPress={onCloseIntro}>
              <Text style={styles.modalCloseText}>{t('common.gotIt')}</Text>
            </TouchableOpacity>
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
      paddingHorizontal: 10,
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    scroll: { flex: 1 },
    balanceCard: {
      margin: 10,
      padding: 16,
      borderRadius: 16,
      backgroundColor: tk.brand.DEFAULT,
      gap: 8,
    },
    balanceLabel: {
      fontSize: 14,
      color: tk.surface.light,
      opacity: 0.8,
    },
    balanceValue: {
      fontSize: 32,
      fontWeight: '700',
      color: tk.surface.light,
    },
    section: {
      paddingHorizontal: 10,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: 12,
    },
    rateBox: {
      marginBottom: 12,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      gap: 4,
    },
    rateTitle: {
      fontSize: 12,
      color: tk.text.tertiary,
      marginBottom: 4,
    },
    rateItem: {
      fontSize: 12,
      color: tk.text.secondary,
    },
    rateItemActive: {
      color: tk.brand.DEFAULT,
      fontWeight: '600',
    },
    amountGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 12,
    },
    amountCard: {
      width: '30%',
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      alignItems: 'center',
    },
    amountCardActive: {
      borderColor: tk.brand.DEFAULT,
      backgroundColor: tk.surface.light,
    },
    amountText: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
    },
    amountTextActive: {
      color: tk.brand.DEFAULT,
    },
    customInput: {
      backgroundColor: tk.surface.muted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: 14,
      height: 50,
      fontSize: 16,
      color: tk.text.primary,
    },
    payList: {
      gap: 10,
    },
    payItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    payItemActive: {
      borderColor: tk.brand.DEFAULT,
    },
    payLabel: {
      fontSize: 16,
      color: tk.text.primary,
    },
    payLabelActive: {
      color: tk.brand.DEFAULT,
      fontWeight: '600',
    },
    payCheck: {
      fontSize: 18,
      color: tk.brand.DEFAULT,
      fontWeight: '700',
    },
    submitBtn: {
      marginHorizontal: 10,
      marginBottom: 12,
      height: 50,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnDisabled: {
      backgroundColor: tk.surface.muted,
    },
    submitBtnText: {
      fontSize: 18,
      fontWeight: '600',
      color: tk.surface.light,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    modalContent: {
      width: '100%',
      backgroundColor: tk.surface.light,
      borderRadius: 16,
      padding: 24,
      gap: 12,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: tk.text.primary,
      textAlign: 'center',
    },
    modalBody: {
      fontSize: 16,
      color: tk.text.secondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    modalClose: {
      height: 44,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCloseText: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.surface.light,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
