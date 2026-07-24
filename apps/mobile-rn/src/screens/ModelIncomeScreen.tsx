import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
} from 'react-native'

type Settle = 'all' | 'pending' | 'settled'

interface IncomeItem {
  id: string
  orderNo: string
  agentName: string
  price: number
  cycle: string
  total: number
  amount: number
  settled: boolean
  time: string
}

const SUMMARY = {
  accumulated: 12860.5,
  withdrawable: 3240.0,
  withdrawn: 9620.5,
  today: 128.0,
  pending: 580.0,
}

const TABS: { id: Settle; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'pending', label: '待结算' },
  { id: 'settled', label: '已结算' },
]

const MOCK_LIST: IncomeItem[] = [
  { id: '1', orderNo: 'NO20260724001', agentName: '文案写作助手', price: 29, cycle: '月', total: 1, amount: 29, settled: false, time: '2026-07-24 10:23' },
  { id: '2', orderNo: 'NO20260723008', agentName: '数据分析专家', price: 199, cycle: '年', total: 1, amount: 199, settled: true, time: '2026-07-23 16:40' },
  { id: '3', orderNo: 'NO20260722015', agentName: 'PPT 生成器', price: 9.9, cycle: '月', total: 3, amount: 29.7, settled: true, time: '2026-07-22 09:12' },
  { id: '4', orderNo: 'NO20260721022', agentName: '文案写作助手', price: 29, cycle: '月', total: 2, amount: 58, settled: false, time: '2026-07-21 14:05' },
  { id: '5', orderNo: 'NO20260720031', agentName: '翻译助手', price: 15, cycle: '永久', total: 1, amount: 15, settled: true, time: '2026-07-20 11:30' },
]

export default function ModelIncomeScreen() {
  const [tab, setTab] = useState<Settle>('all')
  const [showWithdraw, setShowWithdraw] = useState(false)

  const list = MOCK_LIST.filter((i) =>
    tab === 'all' ? true : tab === 'pending' ? !i.settled : i.settled
  )

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>模型收益</Text>
      </View>

      <View style={s.summaryCard}>
        <View style={s.sumTop}>
          <Text style={s.sumLabel}>
            累计收益 <Text style={s.sumAmount}>{SUMMARY.accumulated.toFixed(2)}</Text> 元
          </Text>
          <TouchableOpacity style={s.withdrawBtn} onPress={() => setShowWithdraw(true)} activeOpacity={0.8}>
            <Text style={s.withdrawText}>提现</Text>
          </TouchableOpacity>
        </View>
        <View style={s.sumRow}>
          <View style={s.sumCol}>
            <Text style={s.sumSubLabel}>可提现(元)</Text>
            <Text style={s.sumSubAmount}>{SUMMARY.withdrawable.toFixed(2)}</Text>
          </View>
          <View style={s.sumCol}>
            <Text style={s.sumSubLabel}>已提现(元)</Text>
            <Text style={s.sumSubAmount}>{SUMMARY.withdrawn.toFixed(2)}</Text>
          </View>
        </View>
        <View style={s.sumFooter}>
          <View style={s.sumFooterItem}>
            <Text style={s.sumFooterLabel}>今日收益</Text>
            <Text style={s.sumFooterVal}>{SUMMARY.today.toFixed(2)}</Text>
          </View>
          <View style={s.sumFooterItem}>
            <Text style={s.sumFooterLabel}>待结算</Text>
            <Text style={s.sumFooterVal}>{SUMMARY.pending.toFixed(2)}</Text>
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
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>暂无收益记录</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardHead}>
              <Text style={s.cardOrder} numberOfLines={1}>订单 {item.orderNo}</Text>
              <Text style={[s.cardStatus, item.settled ? s.statusSettled : s.statusPending]}>
                {item.settled ? '已结算' : '待结算'}
              </Text>
            </View>
            <Text style={s.cardTime}>{item.time}</Text>
            <View style={s.cardMain}>
              <View style={s.cardAvatar}>
                <Text style={s.cardAvatarText}>{item.agentName.charAt(0)}</Text>
              </View>
              <View style={s.cardInfo}>
                <Text style={s.cardName} numberOfLines={1}>{item.agentName}</Text>
                <Text style={s.cardMeta}>¥{item.price} / {item.cycle} · ×{item.total}</Text>
              </View>
              <Text style={s.cardAmount}>+¥{item.amount.toFixed(2)}</Text>
            </View>
          </View>
        )}
      />

      <Modal visible={showWithdraw} transparent animationType="slide" onRequestClose={() => setShowWithdraw(false)}>
        <View style={s.modalMask}>
          <View style={s.modalBody}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>选择提现方式</Text>
              <TouchableOpacity onPress={() => setShowWithdraw(false)}>
                <Text style={s.modalClose}>关闭</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.modalSub}>可提现金额 ¥{SUMMARY.withdrawable.toFixed(2)}</Text>
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  summaryCard: { marginHorizontal: 16, padding: 16, borderRadius: 12, backgroundColor: '#F5F3FF' },
  sumTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sumLabel: { fontSize: 13, color: '#374151' },
  sumAmount: { fontSize: 18, fontWeight: '700', color: '#7B61FF' },
  withdrawBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, backgroundColor: '#7B61FF' },
  withdrawText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  sumRow: { flexDirection: 'row', marginTop: 16 },
  sumCol: { flex: 1 },
  sumSubLabel: { fontSize: 12, color: '#6B7280' },
  sumSubAmount: { marginTop: 4, fontSize: 18, fontWeight: '700', color: '#111827' },
  sumFooter: { flexDirection: 'row', marginTop: 14, padding: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.6)' },
  sumFooterItem: { flex: 1 },
  sumFooterLabel: { fontSize: 11, color: '#6B7280' },
  sumFooterVal: { marginTop: 2, fontSize: 14, fontWeight: '600', color: '#111827' },
  tip: { marginHorizontal: 16, marginTop: 10, fontSize: 11, color: '#9CA3AF' },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, padding: 4, borderRadius: 10, backgroundColor: '#F3F4F6' },
  tabItem: { flex: 1, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabItemActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 13, color: '#6B7280' },
  tabTextActive: { color: '#111827', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },
  card: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardOrder: { flex: 1, fontSize: 12, color: '#6B7280' },
  cardStatus: { fontSize: 11, fontWeight: '600' },
  statusSettled: { color: '#10B981' },
  statusPending: { color: '#FF6B00' },
  cardTime: { marginTop: 4, fontSize: 11, color: '#9CA3AF' },
  cardMain: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  cardAvatar: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardAvatarText: { fontSize: 15, fontWeight: '600', color: '#7B61FF' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cardMeta: { marginTop: 2, fontSize: 11, color: '#9CA3AF' },
  cardAmount: { fontSize: 15, fontWeight: '700', color: '#FF6B00' },
  modalMask: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalBody: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  modalClose: { fontSize: 13, color: '#6B7280' },
  modalSub: { marginTop: 8, fontSize: 12, color: '#9CA3AF' },
  payOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingVertical: 8 },
  payLeft: { flexDirection: 'row', alignItems: 'center' },
  payIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#07C160', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  payIconText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  payName: { fontSize: 14, color: '#111827' },
  payRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#7B61FF', backgroundColor: '#7B61FF' },
  modalNote: { marginTop: 12, fontSize: 11, color: '#9CA3AF' },
  modalBtn: { marginTop: 20, height: 44, borderRadius: 12, backgroundColor: '#7B61FF', alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
})
