import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native'
import { getAgents, type Agent } from '@ihui/api-client'
import { useI18n } from '../i18n'

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

export default function AssistantScreen() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('draft')
  const [subTab, setSubTab] = useState<SubTab>('all')
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<Assistant[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const resp = await getAgents({ pageSize: 100 })
      if (!resp.success) throw new Error(resp.error)
      const mapped: Assistant[] = (resp.data.list ?? []).map((a: Agent) => ({
        id: a.id,
        name: a.name,
        prologue: a.description,
        status: a.status === 'pending' ? 'reviewing' : a.status,
        category: a.category || a.tags.join(','),
        price: 0,
        cycle: '',
        audience: a.isVipExclusive ? '会员' : '全部用户',
        publishTime: a.createdAt ? a.createdAt.slice(0, 10) : '-',
      }))
      setItems(mapped)
    } catch {
      setError('加载失败,请下拉刷新重试')
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

  const showSubTab = tab === 'draft'
  const list = items.filter((a) => {
    if (showSubTab) {
      if (subTab === 'all' && a.status !== 'draft') return false
      if (subTab === 'rejected' && a.status !== 'rejected') return false
      if (subTab === 'offline' && a.status !== 'offline') return false
    } else if (a.status !== tab) {
      return false
    }
    return keyword ? a.name.includes(keyword) : true
  })

  const handleEdit = (a: Assistant) => Alert.alert(t('assistant.edit.title'), t('assistant.edit.message', { name: a.name }))
  const handleOffline = (a: Assistant) =>
    Alert.alert(t('assistant.offline.title'), t('assistant.offline.message', { name: a.name }), [
      { text: t('common.cancel') },
      { text: t('assistant.offline.confirmBtn'), style: 'destructive', onPress: () => Alert.alert(t('assistant.offline.done')) },
    ])

  const statusBadge = (a: Assistant) => {
    if (a.status === 'published') return { text: '已发布', color: tokens.success.DEFAULT, bg: tokens.success.light }
    if (a.status === 'reviewing') return { text: '审核中', color: tokens.purple.DEFAULT, bg: tokens.purple.light }
    if (a.status === 'rejected') return { text: '审核失败', color: tokens.warning.deep, bg: tokens.warning.orangeLight }
    if (a.status === 'offline') return { text: '已下架', color: tokens.text.secondary, bg: tokens.surface.card }
    return { text: '待发布', color: tokens.text.secondary, bg: tokens.surface.card }
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
          placeholderTextColor={tokens.text.tertiary}
        />
      </View>

      {error ? (
        <View style={s.errorBar}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>{loading ? '加载中...' : '暂无助手'}</Text>
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
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, padding: 4, borderRadius: 10, backgroundColor: tokens.surface.card },
  tabItem: { flex: 1, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabItemActive: { backgroundColor: tokens.surface.bg },
  tabText: { fontSize: 13, color: tokens.text.secondary },
  tabTextActive: { color: tokens.text.primary, fontWeight: '600' },
  subTabRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 12, gap: 20 },
  subTabItem: { paddingVertical: 4 },
  subTabText: { fontSize: 13, color: tokens.text.secondary },
  subTabTextActive: { color: tokens.purple.DEFAULT, fontWeight: '600' },
  searchRow: { paddingHorizontal: 16, marginTop: 12 },
  searchInput: { height: 38, borderWidth: 1, borderColor: tokens.border.light, borderRadius: 10, paddingHorizontal: 12, fontSize: 13, color: tokens.text.primary, backgroundColor: tokens.surface.muted },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { fontSize: 12, color: tokens.warning.deep },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 13, color: tokens.text.tertiary },
  card: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: tokens.border.light },
  cardHead: { flexDirection: 'row' },
  avatar: { width: 44, height: 44, borderRadius: 10, backgroundColor: tokens.purple.light, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { fontSize: 18, fontWeight: '600', color: tokens.purple.DEFAULT },
  cardMain: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: tokens.text.primary },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  prologue: { marginTop: 4, fontSize: 12, color: tokens.text.secondary },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  metaText: { fontSize: 11, color: tokens.text.tertiary },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionPrimary: { paddingHorizontal: 16, height: 32, borderRadius: 8, backgroundColor: tokens.purple.DEFAULT, alignItems: 'center', justifyContent: 'center' },
  actionPrimaryText: { fontSize: 13, fontWeight: '600', color: tokens.surface.light },
  actionDanger: { paddingHorizontal: 16, height: 32, borderRadius: 8, borderWidth: 1, borderColor: tokens.warning.deep, alignItems: 'center', justifyContent: 'center' },
  actionDangerText: { fontSize: 13, color: tokens.warning.deep },
})
