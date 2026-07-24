import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native'

type Tab = 'draft' | 'reviewing' | 'published'
type SubTab = 'all' | 'rejected' | 'offline'

interface Assistant {
  id: string
  name: string
  prologue: string
  status: Tab | 'rejected' | 'offline'
  category: string
  price: number
  cycle: string
  audience: string
  publishTime: string
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'draft', label: '待发布' },
  { id: 'reviewing', label: '审核中' },
  { id: 'published', label: '已发布' },
]
const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'rejected', label: '审核失败' },
  { id: 'offline', label: '已下架' },
]

const MOCK: Assistant[] = [
  { id: '1', name: '文案写作助手', prologue: '帮你快速生成营销文案、种草笔记', status: 'draft', category: '文字', price: 0, cycle: '', audience: '全部用户', publishTime: '-' },
  { id: '2', name: '数据分析专家', prologue: '上传表格自动生成分析报告', status: 'reviewing', category: '文字,图片', price: 0, cycle: '', audience: '全部用户', publishTime: '-' },
  { id: '3', name: 'PPT 生成器', prologue: '输入主题一键生成 PPT 大纲', status: 'published', category: '文字,图片,视频', price: 9.9, cycle: '月', audience: '全部用户', publishTime: '2026-07-20' },
  { id: '4', name: '翻译助手', prologue: '多语言互译,保留专业术语', status: 'published', category: '文字', price: 15, cycle: '永久', audience: '会员', publishTime: '2026-07-18' },
  { id: '5', name: '客服机器人', prologue: '自动应答常见问题', status: 'rejected', category: '文字', price: 0, cycle: '', audience: '全部用户', publishTime: '-' },
  { id: '6', name: '旧版问答助手', prologue: '基础问答能力', status: 'offline', category: '文字', price: 5, cycle: '月', audience: '全部用户', publishTime: '2026-06-10' },
]

export default function AssistantScreen() {
  const [tab, setTab] = useState<Tab>('draft')
  const [subTab, setSubTab] = useState<SubTab>('all')
  const [keyword, setKeyword] = useState('')

  const showSubTab = tab === 'draft'
  const list = MOCK.filter((a) => {
    if (showSubTab) {
      if (subTab === 'all' && a.status !== 'draft') return false
      if (subTab === 'rejected' && a.status !== 'rejected') return false
      if (subTab === 'offline' && a.status !== 'offline') return false
    } else if (a.status !== tab) {
      return false
    }
    return keyword ? a.name.includes(keyword) : true
  })

  const handleEdit = (a: Assistant) => Alert.alert('操作', `设置「${a.name}」的售卖配置`)
  const handleOffline = (a: Assistant) =>
    Alert.alert('下架确认', `是否确定下架「${a.name}」?`, [
      { text: '取消' },
      { text: '确定下架', style: 'destructive', onPress: () => Alert.alert('已下架') },
    ])

  const statusBadge = (a: Assistant) => {
    if (a.status === 'published') return { text: '已发布', color: '#10B981', bg: '#ECFDF5' }
    if (a.status === 'reviewing') return { text: '审核中', color: '#7B61FF', bg: '#F5F3FF' }
    if (a.status === 'rejected') return { text: '审核失败', color: '#FF6B00', bg: '#FFF7ED' }
    if (a.status === 'offline') return { text: '已下架', color: '#6B7280', bg: '#F3F4F6' }
    return { text: '待发布', color: '#6B7280', bg: '#F3F4F6' }
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>我的助手</Text>
      </View>

      <View style={s.tabRow}>
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <TouchableOpacity
              key={t.id}
              style={[s.tabItem, active && s.tabItemActive]}
              onPress={() => { setTab(t.id); setSubTab('all') }}
              activeOpacity={0.8}
            >
              <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {showSubTab && (
        <View style={s.subTabRow}>
          {SUB_TABS.map((t) => {
            const active = subTab === t.id
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setSubTab(t.id)}
                activeOpacity={0.8}
                style={s.subTabItem}
              >
                <Text style={[s.subTabText, active && s.subTabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={keyword}
          onChangeText={setKeyword}
          placeholder="搜索助手名称"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>暂无助手</Text>
          </View>
        }
        renderItem={({ item }) => {
          const badge = statusBadge(item)
          return (
            <View style={s.card}>
              <View style={s.cardHead}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{item.name.charAt(0)}</Text>
                </View>
                <View style={s.cardMain}>
                  <View style={s.nameRow}>
                    <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                    <View style={[s.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[s.badgeText, { color: badge.color }]}>{badge.text}</Text>
                    </View>
                  </View>
                  <Text style={s.prologue} numberOfLines={2}>{item.prologue}</Text>
                </View>
              </View>
              {item.status === 'published' && (
                <View style={s.cardMeta}>
                  <Text style={s.metaText}>类别: {item.category}</Text>
                  <Text style={s.metaText}>¥{item.price} / {item.cycle || '永久'}</Text>
                  <Text style={s.metaText}>面向: {item.audience}</Text>
                  <Text style={s.metaText}>上架: {item.publishTime}</Text>
                </View>
              )}
              <View style={s.cardActions}>
                {(item.status === 'draft' || item.status === 'reviewing') && (
                  <TouchableOpacity style={s.actionPrimary} onPress={() => handleEdit(item)} activeOpacity={0.8}>
                    <Text style={s.actionPrimaryText}>设置</Text>
                  </TouchableOpacity>
                )}
                {item.status === 'published' && (
                  <TouchableOpacity style={s.actionDanger} onPress={() => handleOffline(item)} activeOpacity={0.8}>
                    <Text style={s.actionDangerText}>下架</Text>
                  </TouchableOpacity>
                )}
                {(item.status === 'rejected' || item.status === 'offline') && (
                  <TouchableOpacity style={s.actionPrimary} onPress={() => handleEdit(item)} activeOpacity={0.8}>
                    <Text style={s.actionPrimaryText}>重新编辑</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, padding: 4, borderRadius: 10, backgroundColor: '#F3F4F6' },
  tabItem: { flex: 1, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabItemActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 13, color: '#6B7280' },
  tabTextActive: { color: '#111827', fontWeight: '600' },
  subTabRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 12, gap: 20 },
  subTabItem: { paddingVertical: 4 },
  subTabText: { fontSize: 13, color: '#6B7280' },
  subTabTextActive: { color: '#7B61FF', fontWeight: '600' },
  searchRow: { paddingHorizontal: 16, marginTop: 12 },
  searchInput: { height: 38, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, fontSize: 13, color: '#111827', backgroundColor: '#F9FAFB' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },
  card: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHead: { flexDirection: 'row' },
  avatar: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { fontSize: 18, fontWeight: '600', color: '#7B61FF' },
  cardMain: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  prologue: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  metaText: { fontSize: 11, color: '#9CA3AF' },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionPrimary: { paddingHorizontal: 16, height: 32, borderRadius: 8, backgroundColor: '#7B61FF', alignItems: 'center', justifyContent: 'center' },
  actionPrimaryText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  actionDanger: { paddingHorizontal: 16, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#FF6B00', alignItems: 'center', justifyContent: 'center' },
  actionDangerText: { fontSize: 13, color: '#FF6B00' },
})
