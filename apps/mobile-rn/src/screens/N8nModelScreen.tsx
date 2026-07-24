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

const MOCK: N8nModel[] = [
  { id: '1', name: '邮件自动回复', desc: '根据邮件内容自动生成回复草稿', url: 'https://n8n.app/webhook/email-reply', status: 'running', calls: 1280, updatedAt: '2026-07-24 09:30', paramsIn: 2, paramsOut: 1 },
  { id: '2', name: '数据报表生成', desc: '定时拉取数据库生成可视化报表', url: 'https://n8n.app/webhook/report-gen', status: 'running', calls: 356, updatedAt: '2026-07-23 18:12', paramsIn: 3, paramsOut: 2 },
  { id: '3', name: '客户线索清洗', desc: '过滤无效线索并打标签', url: 'https://n8n.app/webhook/lead-clean', status: 'stopped', calls: 89, updatedAt: '2026-07-20 14:00', paramsIn: 2, paramsOut: 1 },
  { id: '4', name: '图片批量压缩', desc: '接收图片 URL 返回压缩后链接', url: 'https://n8n.app/webhook/img-compress', status: 'running', calls: 2104, updatedAt: '2026-07-24 11:05', paramsIn: 1, paramsOut: 1 },
  { id: '5', name: '多语言翻译流', desc: '调用翻译 API 并回写文档', url: 'https://n8n.app/webhook/translate', status: 'stopped', calls: 45, updatedAt: '2026-07-18 10:22', paramsIn: 3, paramsOut: 2 },
]

export default function N8nModelScreen() {
  const [tab, setTab] = useState<Status>('all')
  const [keyword, setKeyword] = useState('')

  const list = MOCK.filter((m) => {
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

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16 }}
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
