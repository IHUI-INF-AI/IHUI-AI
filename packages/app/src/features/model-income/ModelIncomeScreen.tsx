import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  ModelIncomeItem,
  ModelIncomeScreenProps,
  ModelIncomeTab,
} from '../../types'

/** ModelIncome 共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { ModelIncomeItem, ModelIncomeScreenProps, ModelIncomeTab }

const TABS: ModelIncomeTab[] = ['all', 'pending', 'settled']

function isSettled(status: string): boolean {
  return status === 'settled' || status === '2'
}

export function ModelIncomeScreen({
  t,
  items,
  summary,
  loading,
  refreshing,
  error,
  activeTab,
  onSelectTab,
  onRefresh,
  showWithdrawModal,
  onOpenWithdraw,
  onCloseWithdraw,
  onConfirmWithdraw,
  onBack,
  colorScheme = 'light',
}: ModelIncomeScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const accumulated = summary?.totalCommission ?? 0
  const withdrawable = summary?.availableCommission ?? 0
  const withdrawn = summary?.withdrawnCommission ?? 0
  const today = summary?.day ?? 0
  const pending = summary?.pendingCommission ?? 0

  const filteredItems = useMemo(
    () =>
      items.filter((i) =>
        activeTab === 'all' ? true : activeTab === 'pending' ? !isSettled(i.status) : isSettled(i.status),
      ),
    [items, activeTab],
  )

  if (loading) {
    return (
      <View style={styles.centerLoad}>
        <ActivityIndicator color={tk.brand.DEFAULT} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centerErr}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRefresh} activeOpacity={0.8}>
          <Text style={styles.retryText}>{t('modelIncome.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('modelIncome.title')}</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.sumTop}>
          <Text style={styles.sumLabel}>
            {t('modelIncome.accumulated')}{' '}
            <Text style={styles.sumAmount}>{accumulated.toFixed(2)}</Text>{' '}
            {t('modelIncome.yuan')}
          </Text>
          <TouchableOpacity
            style={styles.withdrawBtn}
            onPress={onOpenWithdraw}
            activeOpacity={0.8}
          >
            <Text style={styles.withdrawBtnText}>{t('modelIncome.withdrawBtn')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.sumRow}>
          <View style={styles.sumCol}>
            <Text style={styles.sumSubLabel}>{t('modelIncome.withdrawable')}</Text>
            <Text style={styles.sumSubAmount}>{withdrawable.toFixed(2)}</Text>
          </View>
          <View style={styles.sumCol}>
            <Text style={styles.sumSubLabel}>{t('modelIncome.withdrawn')}</Text>
            <Text style={styles.sumSubAmount}>{withdrawn.toFixed(2)}</Text>
          </View>
        </View>
        <View style={styles.sumFooter}>
          <View style={styles.sumFooterItem}>
            <Text style={styles.sumFooterLabel}>{t('modelIncome.today')}</Text>
            <Text style={styles.sumFooterVal}>{today.toFixed(2)}</Text>
          </View>
          <View style={styles.sumFooterItem}>
            <Text style={styles.sumFooterLabel}>{t('modelIncome.pending')}</Text>
            <Text style={styles.sumFooterVal}>{pending.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.tip}>{t('modelIncome.tip')}</Text>

      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const active = tab === activeTab
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => onSelectTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t(`modelIncome.tab.${tab}`)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('modelIncome.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const settled = isSettled(item.status)
          return (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardOrder} numberOfLines={1}>
                  {t('modelIncome.orderLabel')} {item.orderId}
                </Text>
                <Text style={[styles.cardStatus, settled ? styles.statusSettled : styles.statusPending]}>
                  {t(`modelIncome.tab.${settled ? 'settled' : 'pending'}`)}
                </Text>
              </View>
              <Text style={styles.cardTime}>{item.createdAt}</Text>
              <View style={styles.cardMain}>
                <View style={styles.cardAvatar}>
                  <Text style={styles.cardAvatarText}>{item.userNickname.charAt(0)}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.userNickname}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {t('modelIncome.orderLabel')} ¥{item.orderAmount.toFixed(2)} ·{' '}
                    {t('modelIncome.rateLabel')} {item.rate}%
                  </Text>
                </View>
                <Text style={styles.cardAmount}>+¥{item.commissionAmount.toFixed(2)}</Text>
              </View>
            </View>
          )
        }}
      />

      <Modal
        visible={showWithdrawModal}
        transparent
        animationType="slide"
        onRequestClose={onCloseWithdraw}
      >
        <View style={styles.modalMask}>
          <View style={styles.modalBody}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{t('modelIncome.withdrawModal.title')}</Text>
              <TouchableOpacity onPress={onCloseWithdraw} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.modalClose}>{t('modelIncome.withdrawModal.close')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              {t('modelIncome.withdrawModal.subtitle')} ¥{withdrawable.toFixed(2)}
            </Text>
            <TouchableOpacity style={styles.payOption} activeOpacity={0.8}>
              <View style={styles.payLeft}>
                <View style={styles.payIcon}>
                  <Text style={styles.payIconText}>{t('modelIncome.withdrawModal.wechat')}</Text>
                </View>
                <Text style={styles.payName}>{t('modelIncome.withdrawModal.wechat')}</Text>
              </View>
              <View style={styles.payRadio} />
            </TouchableOpacity>
            <Text style={styles.modalNote}>{t('modelIncome.withdrawModal.moreMethods')}</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={onConfirmWithdraw} activeOpacity={0.8}>
              <Text style={styles.modalBtnText}>{t('modelIncome.withdrawModal.confirm')}</Text>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    headerTitle: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    centerLoad: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tk.surface.bg },
    centerErr: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
      padding: 16,
    },
    errorText: { color: tk.text.secondary, marginBottom: 12, textAlign: 'center' },
    retryBtn: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    },
    retryText: { fontSize: 13, fontWeight: '600', color: tk.surface.light },
    summaryCard: {
      marginHorizontal: 16,
      padding: 16,
      borderRadius: 12,
      backgroundColor: tk.purple.light,
    },
    sumTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sumLabel: { fontSize: 13, color: tk.text.medium },
    sumAmount: { fontSize: 18, fontWeight: '700', color: tk.purple.DEFAULT },
    withdrawBtn: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: tk.purple.DEFAULT,
    },
    withdrawBtnText: { fontSize: 13, fontWeight: '600', color: tk.surface.light },
    sumRow: { flexDirection: 'row', marginTop: 16 },
    sumCol: { flex: 1 },
    sumSubLabel: { fontSize: 12, color: tk.text.secondary },
    sumSubAmount: {
      marginTop: 4,
      fontSize: 18,
      fontWeight: '700',
      color: tk.text.primary,
    },
    sumFooter: {
      flexDirection: 'row',
      marginTop: 14,
      padding: 10,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
    },
    sumFooterItem: { flex: 1 },
    sumFooterLabel: { fontSize: 11, color: tk.text.secondary },
    sumFooterVal: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    },
    tip: { marginHorizontal: 16, marginTop: 10, fontSize: 11, color: tk.text.tertiary },
    tabRow: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 12,
      padding: 4,
      borderRadius: 10,
      backgroundColor: tk.surface.card,
    },
    tabItem: {
      flex: 1,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabItemActive: { backgroundColor: tk.surface.light },
    tabText: { fontSize: 13, color: tk.text.secondary },
    tabTextActive: { color: tk.text.primary, fontWeight: '600' },
    empty: { alignItems: 'center', paddingVertical: 48 },
    emptyText: { fontSize: 13, color: tk.text.tertiary },
    card: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardOrder: { flex: 1, fontSize: 12, color: tk.text.secondary },
    cardStatus: { fontSize: 11, fontWeight: '600' },
    statusSettled: { color: tk.brand.DEFAULT },
    statusPending: { color: tk.warning.deep },
    cardTime: { marginTop: 4, fontSize: 11, color: tk.text.tertiary },
    cardMain: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    cardAvatar: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: tk.purple.light,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    cardAvatarText: { fontSize: 15, fontWeight: '600', color: tk.purple.DEFAULT },
    cardInfo: { flex: 1 },
    cardName: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    cardMeta: { marginTop: 2, fontSize: 11, color: tk.text.tertiary },
    cardAmount: { fontSize: 15, fontWeight: '700', color: tk.warning.deep },
    modalMask: { flex: 1, justifyContent: 'flex-end', backgroundColor: tk.overlay.modal },
    modalBody: {
      backgroundColor: tk.surface.light,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
    },
    modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    modalClose: { fontSize: 13, color: tk.text.secondary },
    modalSub: { marginTop: 8, fontSize: 12, color: tk.text.tertiary },
    payOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
      paddingVertical: 8,
    },
    payLeft: { flexDirection: 'row', alignItems: 'center' },
    payIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    payIconText: { fontSize: 14, fontWeight: '600', color: tk.surface.light },
    payName: { fontSize: 14, color: tk.text.primary },
    payRadio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: tk.purple.DEFAULT,
      backgroundColor: tk.purple.DEFAULT,
    },
    modalNote: { marginTop: 12, fontSize: 11, color: tk.text.tertiary },
    modalBtn: {
      marginTop: 20,
      height: 44,
      borderRadius: 12,
      backgroundColor: tk.purple.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBtnText: { fontSize: 15, fontWeight: '600', color: tk.surface.light },
  })
}
