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
  ActivityIndicator,
} from 'react-native'
import { getN8nWorkflows, type N8nWorkflow } from '@ihui/api-client'

type Status = 'all' | 'running' | 'stopped'

interface N8nModel {
  id: string
  name: string
  desc: string
  url: string
  status: 'running' | 'stopped'
  calls: number
  updatedAt: string
  paramsIn: number
  paramsOut: number
}

const TABS: { id: Status; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'running', label: '运行中' },
  { id: 'stopped', label: '已停止' },
]

function toNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function toString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function mapWorkflow(w: N8nWorkflow): N8nModel {
  return {
    id: w.id,
    name: w.name,
    desc: w.description ?? '',
    url: toString(w.url),
    status: w.active ? 'running' : 'stopped',
    calls: toNumber(w.calls),
    updatedAt: w.updatedAt ?? w.createdAt ?? '',
    paramsIn: toNumber(w.paramsIn),
    paramsOut: toNumber(w.paramsOut),
  }
}

export default function N8nModelScreen() {
  const [tab, setTab] = useState<Status>('all')
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<N8nModel[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getN8nWorkflows()
      if (res.success) {
        setItems((res.data?.list ?? []).map(mapWorkflow))
      } else {
        setError(res.error || '加载失败')
      }
    } catch {
      setError('加载失败')
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

  const list = items.filter((m) => {
    const matchTab = tab === 'all' ? true : m.status === tab
    const matchKw = keyword ? m.name.includes(keyword) || m.desc.includes(keyword) : true
    return matchTab && matchKw
  })

  const handleToggle = (m: N8nModel) => {
    Alert.alert(
      m.status === 'running' ? '停止工作流' : '启动工作流',
      `确定${m.status === 'running' ? '停止' : '启动'}「${m.name}」吗?`,
      [
        { text: '取消' },
        { text: '确定', onPress: () => Alert.alert('操作成功') },
      ]
    )
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>n8n 模型管理</Text>
        <TouchableOpacity style={s.createBtn} activeOpacity={0.8}>
          <Text style={s.createText}>+ 新建</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={keyword}
          onChangeText={setKeyword}
          placeholder="搜索工作流名称或描述"
          placeholderTextColor="#9CA3AF"
        />
      </View>

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

      {error ? (
        <View style={s.errorBar}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load()} activeOpacity={0.8}>
            <Text style={s.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color="#7B61FF" />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7B61FF']} />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>暂无 n8n 工作流</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardHead}>
                <View style={s.cardTitleRow}>
                  <View style={[s.dot, item.status === 'running' ? s.dotRun : s.dotStop]} />
                  <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                </View>
                <Text style={[s.badge, item.status === 'running' ? s.badgeRun : s.badgeStop]}>
                  {item.status === 'running' ? '运行中' : '已停止'}
                </Text>
              </View>
              <Text style={s.cardDesc} numberOfLines={2}>{item.desc}</Text>
              <Text style={s.cardUrl} numberOfLines={1}>{item.url}</Text>
              <View style={s.cardMeta}>
                <Text style={s.metaText}>调用 {item.calls}</Text>
                <Text style={s.metaText}>入参 {item.paramsIn} · 出参 {item.paramsOut}</Text>
                <Text style={s.metaText}>{item.updatedAt}</Text>
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity
                  style={[s.actionBtn, item.status === 'running' ? s.actionStop : s.actionStart]}
                  onPress={() => handleToggle(item)}
                  activeOpacity={0.8}
                >
                  <Text style={s.actionText}>
                    {item.status === 'running' ? '停止' : '启动'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionEdit} activeOpacity={0.8}>
                  <Text style={s.actionEditText}>编辑</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  createBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: '#7B61FF' },
  createText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  searchRow: { paddingHorizontal: 16 },
  searchInput: { height: 38, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, fontSize: 13, color: '#111827', backgroundColor: '#F9FAFB' },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, padding: 4, borderRadius: 10, backgroundColor: '#F3F4F6' },
  tabItem: { flex: 1, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabItemActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 13, color: '#6B7280' },
  tabTextActive: { color: '#111827', fontWeight: '600' },
  errorBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FEF2F2' },
  errorText: { fontSize: 12, color: '#DC2626' },
  retryText: { fontSize: 12, fontWeight: '600', color: '#7B61FF' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },
  card: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  dotRun: { backgroundColor: '#10B981' },
  dotStop: { backgroundColor: '#9CA3AF' },
  cardName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  badge: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeRun: { color: '#10B981', backgroundColor: '#ECFDF5' },
  badgeStop: { color: '#6B7280', backgroundColor: '#F3F4F6' },
  cardDesc: { marginTop: 8, fontSize: 13, color: '#374151' },
  cardUrl: { marginTop: 6, fontSize: 11, color: '#7B61FF' },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  metaText: { fontSize: 11, color: '#9CA3AF' },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { paddingHorizontal: 16, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionStart: { backgroundColor: '#10B981' },
  actionStop: { backgroundColor: '#FF6B00' },
  actionText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  actionEdit: { paddingHorizontal: 16, height: 34, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  actionEditText: { fontSize: 13, color: '#374151' },
})
