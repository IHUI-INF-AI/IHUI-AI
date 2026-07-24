import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native'

type Tab = 'mine' | 'discover'

interface Member {
  id: string
  name: string
  role: string
}

interface Group {
  id: string
  name: string
  desc: string
  members: Member[]
  messages: number
  lastActive: string
  tag: string
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'mine', label: '我的群组' },
  { id: 'discover', label: '发现' },
]

const MOCK: Group[] = [
  {
    id: '1',
    name: '产品策划小队',
    desc: '产品经理 + UI 设计师 + 用研专家协同输出方案',
    members: [
      { id: 'm1', name: '产品经理', role: '主持' },
      { id: 'm2', name: 'UI 设计师', role: '视觉' },
      { id: 'm3', name: '用研专家', role: '调研' },
    ],
    messages: 1284,
    lastActive: '5 分钟前',
    tag: '产品',
  },
  {
    id: '2',
    name: '内容创作组',
    desc: '选题策划 + 文案撰写 + SEO 优化一条龙',
    members: [
      { id: 'm1', name: '选题策划', role: '主持' },
      { id: 'm2', name: '文案撰写', role: '创作' },
      { id: 'm3', name: 'SEO 优化', role: '优化' },
      { id: 'm4', name: '配图生成', role: '视觉' },
    ],
    messages: 892,
    lastActive: '1 小时前',
    tag: '内容',
  },
  {
    id: '3',
    name: '代码评审团',
    desc: '前端 + 后端 + 测试三方联合代码审查',
    members: [
      { id: 'm1', name: '前端工程师', role: '前端' },
      { id: 'm2', name: '后端工程师', role: '后端' },
      { id: 'm3', name: '测试工程师', role: '测试' },
    ],
    messages: 2103,
    lastActive: '刚刚',
    tag: '研发',
  },
  {
    id: '4',
    name: '学习辅导小组',
    desc: '语文 + 数学 + 英语三位老师联合答疑',
    members: [
      { id: 'm1', name: '语文老师', role: '语文' },
      { id: 'm2', name: '数学老师', role: '数学' },
      { id: 'm3', name: '英语老师', role: '英语' },
    ],
    messages: 542,
    lastActive: '昨天',
    tag: '教育',
  },
]

export default function AiGroupScreen() {
  const [tab, setTab] = useState<Tab>('mine')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = MOCK.find((g) => g.id === selectedId) || null
  const list = tab === 'mine' ? MOCK : MOCK.slice().reverse()

  const handleEnter = (g: Group) => setSelectedId(g.id)
  const handleJoin = (g: Group) => Alert.alert('加入群组', `已申请加入「${g.name}」`)

  if (selected) {
    return (
      <View style={s.container}>
        <View style={s.detailHead}>
          <TouchableOpacity onPress={() => setSelectedId(null)} hitSlop={8}>
            <Text style={s.backText}>返回</Text>
          </TouchableOpacity>
          <Text style={s.detailTitle} numberOfLines={1}>{selected.name}</Text>
        </View>
        <ScrollView style={s.detailBody} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Text style={s.detailDesc}>{selected.desc}</Text>
          <View style={s.metaRow}>
            <Text style={s.metaText}>活跃 {selected.lastActive}</Text>
            <Text style={s.metaText}>消息 {selected.messages}</Text>
          </View>

          <Text style={s.sectionTitle}>协作成员({selected.members.length})</Text>
          {selected.members.map((m) => (
            <View key={m.id} style={s.memberItem}>
              <View style={s.memberAvatar}>
                <Text style={s.memberAvatarText}>{m.name.charAt(0)}</Text>
              </View>
              <View style={s.memberMain}>
                <Text style={s.memberName}>{m.name}</Text>
                <Text style={s.memberRole}>角色: {m.role}</Text>
              </View>
              <View style={s.roleBadge}>
                <Text style={s.roleBadgeText}>{m.role}</Text>
              </View>
            </View>
          ))}

          <Text style={s.sectionTitle}>最近对话</Text>
          <View style={s.previewBubble}>
            <Text style={s.previewName}>{selected.members[0]?.name}</Text>
            <Text style={s.previewText}>大家好,我们开始本次协作,先确认目标与分工。</Text>
          </View>
          <View style={s.previewBubbleMine}>
            <Text style={s.previewTextMine}>收到,我这边准备开始调研。</Text>
          </View>

          <TouchableOpacity style={s.enterBtn} onPress={() => handleEnter(selected)} activeOpacity={0.85}>
            <Text style={s.enterBtnText}>进入群聊</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>AI 群组</Text>
        <Text style={s.headerSub}>多 AI 协同,群智共创</Text>
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
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>暂无群组</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => (tab === 'mine' ? handleEnter(item) : handleJoin(item))}
            activeOpacity={0.85}
          >
            <View style={s.cardHead}>
              <View style={s.cardIcon}>
                <Text style={s.cardIconText}>{item.name.charAt(0)}</Text>
              </View>
              <View style={s.cardMain}>
                <View style={s.nameRow}>
                  <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                  <View style={s.tagBadge}>
                    <Text style={s.tagText}>{item.tag}</Text>
                  </View>
                </View>
                <Text style={s.desc} numberOfLines={2}>{item.desc}</Text>
              </View>
            </View>
            <View style={s.cardFoot}>
              <View style={s.memberPreview}>
                {item.members.slice(0, 3).map((m, i) => (
                  <View key={m.id} style={[s.miniAvatar, { marginLeft: i === 0 ? 0 : -6 }]}>
                    <Text style={s.miniAvatarText}>{m.name.charAt(0)}</Text>
                  </View>
                ))}
                {item.members.length > 3 ? (
                  <Text style={s.moreText}>+{item.members.length - 3}</Text>
                ) : null}
              </View>
              <Text style={s.footMeta}>{item.members.length} 成员 · {item.messages} 消息</Text>
              <View style={s.enterMiniBtn}>
                <Text style={s.enterMiniText}>{tab === 'mine' ? '进入' : '加入'}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  headerSub: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, padding: 4, borderRadius: 10, backgroundColor: '#F3F4F6' },
  tabItem: { flex: 1, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabItemActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 13, color: '#6B7280' },
  tabTextActive: { color: '#111827', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },
  card: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHead: { flexDirection: 'row' },
  cardIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardIconText: { fontSize: 18, fontWeight: '600', color: '#4F46E5' },
  cardMain: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#F5F3FF' },
  tagText: { fontSize: 11, color: '#7B61FF' },
  desc: { marginTop: 4, fontSize: 12, color: '#6B7280', lineHeight: 18 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  memberPreview: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFFFFF' },
  miniAvatarText: { fontSize: 10, fontWeight: '600', color: '#6B7280' },
  moreText: { marginLeft: 4, fontSize: 11, color: '#9CA3AF' },
  footMeta: { fontSize: 11, color: '#9CA3AF' },
  enterMiniBtn: { marginLeft: 'auto', paddingHorizontal: 12, height: 28, borderRadius: 8, backgroundColor: '#7B61FF', alignItems: 'center', justifyContent: 'center' },
  enterMiniText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  detailHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomColor: '#F3F4F6', borderBottomWidth: 1 },
  backText: { fontSize: 14, color: '#7B61FF', marginRight: 12 },
  detailTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111827' },
  detailBody: { flex: 1 },
  detailDesc: { fontSize: 13, color: '#4B5563', lineHeight: 20 },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  metaText: { fontSize: 11, color: '#9CA3AF' },
  sectionTitle: { marginTop: 20, marginBottom: 10, fontSize: 13, fontWeight: '600', color: '#111827' },
  memberItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#F9FAFB', paddingHorizontal: 12, marginBottom: 8 },
  memberAvatar: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  memberAvatarText: { fontSize: 14, fontWeight: '600', color: '#4F46E5' },
  memberMain: { flex: 1 },
  memberName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  memberRole: { marginTop: 2, fontSize: 11, color: '#9CA3AF' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#F5F3FF' },
  roleBadgeText: { fontSize: 11, color: '#7B61FF' },
  previewBubble: { padding: 10, borderRadius: 10, backgroundColor: '#F3F4F6', marginBottom: 8 },
  previewName: { fontSize: 11, color: '#7B61FF', fontWeight: '600', marginBottom: 4 },
  previewText: { fontSize: 13, color: '#374151', lineHeight: 18 },
  previewBubbleMine: { padding: 10, borderRadius: 10, backgroundColor: '#7B61FF', alignSelf: 'flex-end', maxWidth: '80%', marginBottom: 8 },
  previewTextMine: { fontSize: 13, color: '#FFFFFF', lineHeight: 18 },
  enterBtn: { marginTop: 16, height: 44, borderRadius: 10, backgroundColor: '#7B61FF', alignItems: 'center', justifyContent: 'center' },
  enterBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
})
