import { useCallback, useEffect, useState } from 'react'
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
import { tokens } from '@ihui/rn-app'
import {
  getOverview,
  getCommissionList,
  getDayMonthSummary,
  type CommissionOverview,
  type CommissionRecord,
  type DayMonthSummary,
} from '@ihui/api-client'

type Settle = 'all' | 'pending' | 'settled'

const TABS: { id: Settle; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'pending', label: '待结算' },
  { id: 'settled', label: '已结算' },
]

function isSettled(status: string): boolean {
  return status === 'settled' || status === '2'
}

function formatTime(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16)
}

export default function ModelIncomeScreen() {
  const [tab, setTab] = useState<Settle>('all')
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [summary, setSummary] = useState<CommissionOverview | null>(null)
  const [dayMonth, setDayMonth] = useState<DayMonthSummary | null>(null)
  const [records, setRecords] = useState<CommissionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [overviewRes, listRes, dayMonthRes] = await Promise.all([
        getOverview(),
        getCommissionList({ page: 1, pageSize: 50 }),
        getDayMonthSummary(),
      ])
      let errMsg = ''
      if (overviewRes.success) setSummary(overviewRes.data)
      else errMsg = overviewRes.error || '加载概要失败'
      if (listRes.success) setRecords(listRes.data.list)
      else errMsg = errMsg || (listRes.error || '加载明细失败')
      if (dayMonthRes.success) setDayMonth(dayMonthRes.data)
      if (errMsg) setError(errMsg)
    } catch {
      setError('网络异常,请稍后重试')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const list = records.filter((i) =>
    tab === 'all' ? true : tab === 'pending' ? !isSettled(i.status) : isSettled(i.status),
  )

  const accumulated = summary?.totalCommission ?? 0
  const withdrawable = summary?.availableCommission ?? 0
  const withdrawn = summary?.withdrawnCommission ?? 0
  const today = dayMonth?.day ?? 0
  const pending = summary?.pendingCommission ?? 0

  if (loading) {
    return (
      <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={tokens.brand.DEFAULT} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={[s.container, { alignItems: 'center', justifyContent: 'center', padding: 16 }]}>
        <Text style={{ color: tokens.text.secondary, marginBottom: 12 }}>{error}</Text>
        <TouchableOpacity
          style={s.withdrawBtn}
          onPress={() => {
            setLoading(true)
            void load()
          }}
          activeOpacity={0.8}
        >
          <Text style={s.withdrawText}>重试</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>模型收益</Text>
      </View>

      <View style={s.summaryCard}>
        <View style={s.sumTop}>
          <Text style={s.sumLabel}>
            累计收益 <Text style={s.sumAmount}>{accumulated.toFixed(2)}</Text> 元
          </Text>
          <TouchableOpacity
            style={s.withdrawBtn}
            onPress={() => setShowWithdraw(true)}
            activeOpacity={0.8}
          >
            <Text style={s.withdrawText}>提现</Text>
          </TouchableOpacity>
        </View>
        <View style={s.sumRow}>
          <View style={s.sumCol}>
            <Text style={s.sumSubLabel}>可提现(元)</Text>
            <Text style={s.sumSubAmount}>{withdrawable.toFixed(2)}</Text>
          </View>
          <View style={s.sumCol}>
            <Text style={s.sumSubLabel}>已提现(元)</Text>
            <Text style={s.sumSubAmount}>{withdrawn.toFixed(2)}</Text>
          </View>
        </View>
        <View style={s.sumFooter}>
          <View style={s.sumFooterItem}>
            <Text style={s.sumFooterLabel}>今日收益</Text>
            <Text style={s.sumFooterVal}>{today.toFixed(2)}</Text>
          </View>
          <View style={s.sumFooterItem}>
            <Text style={s.sumFooterLabel}>待结算</Text>
            <Text style={s.sumFooterVal}>{pending.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      <Text style={s.tip}>平台限时不收取任何服务费</Text>

      <View style={s.tabRow}>
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <TouchableOpacity
              key={t.id}
              style={[s.tabItem, active && s.tabItemActive]}
              onPress={() => setTab(t.id)}
              activeOpacity={0.8}
            >
              <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>暂无收益记录</Text>
          </View>
        }
        renderItem={({ item }) => {
          const settled = isSettled(item.status)
          return (
            <View style={s.card}>
              <View style={s.cardHead}>
                <Text style={s.cardOrder} numberOfLines={1}>
                  订单 {item.orderId}
                </Text>
                <Text style={[s.cardStatus, settled ? s.statusSettled : s.statusPending]}>
                  {settled ? '已结算' : '待结算'}
                </Text>
              </View>
              <Text style={s.cardTime}>{formatTime(item.createdAt)}</Text>
              <View style={s.cardMain}>
                <View style={s.cardAvatar}>
                  <Text style={s.cardAvatarText}>{item.userNickname.charAt(0)}</Text>
                </View>
                <View style={s.cardInfo}>
                  <Text style={s.cardName} numberOfLines={1}>
                    {item.userNickname}
                  </Text>
                  <Text style={s.cardMeta}>
                    订单 ¥{item.orderAmount.toFixed(2)} · 费率 {item.rate}%
                  </Text>
                </View>
                <Text style={s.cardAmount}>+¥{item.commissionAmount.toFixed(2)}</Text>
              </View>
            </View>
          )
        }}
      />

      <Modal
        visible={showWithdraw}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWithdraw(false)}
      >
        <View style={s.modalMask}>
          <View style={s.modalBody}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>选择提现方式</Text>
              <TouchableOpacity onPress={() => setShowWithdraw(false)}>
                <Text style={s.modalClose}>关闭</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.modalSub}>可提现金额 ¥{withdrawable.toFixed(2)}</Text>
            <TouchableOpacity style={s.payOption} activeOpacity={0.8}>
              <View style={s.payLeft}>
                <View style={s.payIcon}>
                  <Text style={s.payIconText}>微</Text>
                </View>
                <Text style={s.payName}>微信</Text>
              </View>
              <View style={s.payRadio} />
            </TouchableOpacity>
            <Text style={s.modalNote}>更多提现方式请使用官方 APP</Text>
            <TouchableOpacity
              style={s.modalBtn}
              onPress={() => setShowWithdraw(false)}
              activeOpacity={0.8}
            >
              <Text style={s.modalBtnText}>确认提现</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.light },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  summaryCard: { marginHorizontal: 16, padding: 16, borderRadius: 12, backgroundColor: '#F5F3FF' },
  sumTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sumLabel: { fontSize: 13, color: tokens.text.medium },
  sumAmount: { fontSize: 18, fontWeight: '700', color: '#7B61FF' },
  withdrawBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#7B61FF',
  },
  withdrawText: { fontSize: 13, fontWeight: '600', color: tokens.surface.light },
  sumRow: { flexDirection: 'row', marginTop: 16 },
  sumCol: { flex: 1 },
  sumSubLabel: { fontSize: 12, color: tokens.text.secondary },
  sumSubAmount: { marginTop: 4, fontSize: 18, fontWeight: '700', color: tokens.text.primary },
  sumFooter: {
    flexDirection: 'row',
    marginTop: 14,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  sumFooterItem: { flex: 1 },
  sumFooterLabel: { fontSize: 11, color: tokens.text.secondary },
  sumFooterVal: { marginTop: 2, fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  tip: { marginHorizontal: 16, marginTop: 10, fontSize: 11, color: tokens.text.tertiary },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 4,
    borderRadius: 10,
    backgroundColor: tokens.surface.card,
  },
  tabItem: { flex: 1, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabItemActive: { backgroundColor: tokens.surface.light },
  tabText: { fontSize: 13, color: tokens.text.secondary },
  tabTextActive: { color: tokens.text.primary, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 13, color: tokens.text.tertiary },
  card: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: tokens.border.light },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardOrder: { flex: 1, fontSize: 12, color: tokens.text.secondary },
  cardStatus: { fontSize: 11, fontWeight: '600' },
  statusSettled: { color: tokens.brand.DEFAULT },
  statusPending: { color: '#FF6B00' },
  cardTime: { marginTop: 4, fontSize: 11, color: tokens.text.tertiary },
  cardMain: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  cardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardAvatarText: { fontSize: 15, fontWeight: '600', color: '#7B61FF' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  cardMeta: { marginTop: 2, fontSize: 11, color: tokens.text.tertiary },
  cardAmount: { fontSize: 15, fontWeight: '700', color: '#FF6B00' },
  modalMask: { flex: 1, justifyContent: 'flex-end', backgroundColor: tokens.overlay.modal },
  modalBody: {
    backgroundColor: tokens.surface.light,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '600', color: tokens.text.primary },
  modalClose: { fontSize: 13, color: tokens.text.secondary },
  modalSub: { marginTop: 8, fontSize: 12, color: tokens.text.tertiary },
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
    backgroundColor: '#07C160',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  payIconText: { fontSize: 14, fontWeight: '600', color: tokens.surface.light },
  payName: { fontSize: 14, color: tokens.text.primary },
  payRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#7B61FF',
    backgroundColor: '#7B61FF',
  },
  modalNote: { marginTop: 12, fontSize: 11, color: tokens.text.tertiary },
  modalBtn: {
    marginTop: 20,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#7B61FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: { fontSize: 15, fontWeight: '600', color: tokens.surface.light },
})
