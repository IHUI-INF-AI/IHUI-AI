// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Calendar, DollarSign, LineChart, Search, TrendingUp, X } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'fundDataPage'

export interface FundDataRowView {
  id: string
  code: string
  name: string
  /** 基金类型，可空（后端 funds.type 可空） */
  type: string | null
  /** 1=活跃 */
  status: number
  /** 薄壳注入的状态文案（活跃/停用） */
  statusText: string
}

export interface FundNetValueRowView {
  id: string
  /** YYYY-MM-DD */
  dateText: string
  /** 薄壳按 web 同口径 toFixed(4) 格式化后的净值 */
  netValueText: string
}

export interface FundDataScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门（后端 /api/fund* 走 userAuthPreHandler，需登录） */
  loginRequiredText: string
  /** 搜索框受控值 */
  searchValue: string
  onSearchChange: (text: string) => void
  loading: boolean
  error: string | null
  rows: FundDataRowView[]
  total: number
  onRefresh: () => void
  /** 详情弹层可见性 */
  detailVisible: boolean
  detailTitle: string
  detailLoading: boolean
  detailError: string | null
  historyRows: FundNetValueRowView[]
  onSelectFund: (code: string) => void
  onCloseDetail: () => void
}

/**
 * 基金数据共享屏 —— 承载 web /fund-data
 * (GET /api/fund + GET /api/fund/:code/history)。
 *
 * 与 web 的口径差（如实登记，详见 manifest ledger）：
 *  - web 是「搜索卡片 + 四列表格 + 详情 Dialog」，RN 落为「搜索框 + 卡片行 +
 *    详情 Modal」，同一端点同参数（page=1/pageSize=50，history page=1/pageSize=100）。
 *  - web 详情 Dialog 用 date 原样展示、净值 toFixed(4)；RN 同口径，净值格式化在薄壳完成。
 *  - web 搜索提示「搜索基金代码或名称」，后端 search 只对基金名称做 ilike
 *    （apps/api/src/db/fund-queries.ts:13），代码不支持搜索，如实登记。
 *  - web 该页无登录门，但后端 /api/fund* 走 userAuthPreHandler 必须登录
 *    （apps/api/src/routes/user/_shared.ts:50），RN 侧加登录门。
 *
 * 平台无关：取数/净值格式化/状态文案全部由薄壳注入，本文件只管渲染与三态。
 */
export function FundDataScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  searchValue,
  onSearchChange,
  loading,
  error,
  rows,
  total,
  onRefresh,
  detailVisible,
  detailTitle,
  detailLoading,
  detailError,
  historyRows,
  onSelectFund,
  onCloseDetail,
}: FundDataScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <TrendingUp size={20} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          </View>
          <Text style={styles.muted}>{t(`${NS}.subtitle`)}</Text>
        </View>
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : (
        <>
          <View style={styles.searchBox}>
            <Search size={16} color={tk.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              value={searchValue}
              onChangeText={onSearchChange}
              placeholder={t(`${NS}.search`)}
              placeholderTextColor={tk.text.tertiary}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              underlineColorAndroid="transparent"
            />
            {searchValue.length > 0 ? (
              <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={8}>
                <X size={16} color={tk.text.tertiary} />
              </TouchableOpacity>
            ) : null}
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
              <DollarSign size={30} color={tk.text.tertiary} />
              <Text style={styles.muted}>{t(`${NS}.noFunds`)}</Text>
            </View>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{t(`${NS}.fundCode`)}</Text>
                    <Text style={styles.code}>{item.code}</Text>
                  </View>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{t(`${NS}.fundName`)}</Text>
                    <Text style={styles.name}>{item.name}</Text>
                  </View>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{t(`${NS}.fundType`)}</Text>
                    {item.type ? <Text style={styles.type}>{item.type}</Text> : null}
                  </View>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{t(`${NS}.fundStatus`)}</Text>
                    <Text
                      style={[
                        styles.badge,
                        item.status === 1 ? styles.badgeActive : styles.badgeMuted,
                      ]}
                    >
                      {item.statusText}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.detailBtn}
                    onPress={() => onSelectFund(item.code)}
                  >
                    <Text style={styles.detailBtnText}>{t(`${NS}.viewDetail`)}</Text>
                  </TouchableOpacity>
                </View>
              )}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
              ListFooterComponent={
                total > 0 ? <Text style={styles.footerMuted}>{t(`${NS}.totalOf`, { total })}</Text> : null
              }
            />
          )}
        </>
      )}

      <Modal
        visible={detailVisible}
        transparent
        animationType="slide"
        onRequestClose={onCloseDetail}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <View style={styles.titleRow}>
                <LineChart size={18} color={tk.brand.DEFAULT} />
                <Text style={styles.modalTitle}>{detailTitle}</Text>
              </View>
              <TouchableOpacity onPress={onCloseDetail} hitSlop={8}>
                <X size={18} color={tk.text.secondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.muted}>{t(`${NS}.history`)}</Text>

            {detailLoading ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
              </View>
            ) : detailError ? (
              <Text style={styles.error}>{detailError}</Text>
            ) : historyRows.length === 0 ? (
              <View style={styles.centerBlock}>
                <Calendar size={30} color={tk.text.tertiary} />
                <Text style={styles.muted}>{t(`${NS}.noFunds`)}</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll}>
                <View style={styles.historyHead}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.date`)}</Text>
                  <Text style={styles.fieldLabel}>{t(`${NS}.netValue`)}</Text>
                </View>
                {historyRows.map((row) => (
                  <View key={row.id} style={styles.historyRow}>
                    <Text style={styles.historyDate}>{row.dateText}</Text>
                    <Text style={styles.historyValue}>{row.netValueText}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
    titleBox: { flex: 1, gap: 2 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
      paddingHorizontal: rnSpacing.sm,
      height: 40,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
    },
    searchInput: { flex: 1, fontSize: rnType.body.size, color: tk.text.primary, paddingVertical: 0 },
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
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    code: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      fontSize: rnType.caption.size,
      fontWeight: '500',
    },
    badgeActive: { backgroundColor: tk.success.lightest, color: tk.success.deepText },
    badgeMuted: { backgroundColor: tk.surface.muted, color: tk.text.secondary },
    name: { fontSize: rnType.body.size, color: tk.text.primary },
    type: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      fontSize: rnType.caption.size,
      backgroundColor: tk.surface.muted,
      color: tk.text.secondary,
    },
    detailBtn: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    detailBtnText: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.text.primary },
    footerMuted: {
      textAlign: 'center',
      paddingVertical: rnSpacing.md,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: tk.overlay.modal,
    },
    modalCard: {
      maxHeight: '85%',
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      paddingBottom: rnSpacing.xl,
      borderTopLeftRadius: rnRadius.xl,
      borderTopRightRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
    },
    modalHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    modalTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    modalScroll: { marginTop: rnSpacing.sm },
    historyHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
      paddingBottom: rnSpacing.xs,
    },
    fieldLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: tk.border.light,
    },
    historyDate: { fontSize: rnType.caption.size, color: tk.text.secondary },
    historyValue: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
