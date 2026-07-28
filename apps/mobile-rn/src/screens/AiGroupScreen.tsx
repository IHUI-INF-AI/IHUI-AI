import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getGroups } from '@ihui/api-client'
import type { Group as ApiGroup } from '@ihui/api-client'

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

function isMembers(v: unknown): v is Member[] {
  return (
    Array.isArray(v) &&
    v.every(
      (m) =>
        m !== null &&
        typeof m === 'object' &&
        typeof m.id === 'string' &&
        typeof m.name === 'string',
    )
  )
}

function mapGroup(g: ApiGroup): Group {
  const members = isMembers(g.members) ? g.members : []
  const messages = typeof g.messages === 'number' ? g.messages : 0
  const lastActive = typeof g.lastActive === 'string' ? g.lastActive : g.createdAt
  const tag = typeof g.tag === 'string' ? g.tag : (g.type ?? '')
  return {
    id: g.id,
    name: g.name,
    desc: g.description ?? '',
    members,
    messages,
    lastActive,
    tag,
  }
}

export default function AiGroupScreen() {
  const [tab, setTab] = useState<Tab>('mine')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [items, setItems] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getGroups()
      if (res.success) {
        setItems(res.data.list.map(mapGroup))
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

  const selected = items.find((g) => g.id === selectedId) || null
  const list = tab === 'mine' ? items : items.slice().reverse()

  const handleEnter = (g: Group) => setSelectedId(g.id)
  const handleJoin = (g: Group) => Alert.alert('加入群组', `已申请加入「${g.name}」`)

  if (loading) {
    return (
      <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={tokens.text.secondary} />
      </View>
    )
  }

  if (error && items.length === 0) {
    return (
      <View style={[s.container, { alignItems: 'center', justifyContent: 'center', padding: 16 }]}>
        <Text style={[s.emptyText, { marginBottom: 12 }]}>{error}</Text>
        <TouchableOpacity style={s.enterMiniBtn} onPress={() => void load()} activeOpacity={0.85}>
          <Text style={s.enterMiniText}>重试</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (selected) {
    return (
      <View style={s.container}>
        <View style={s.detailHead}>
          <TouchableOpacity onPress={() => setSelectedId(null)} hitSlop={8}>
            <Text style={s.backText}>返回</Text>
          </TouchableOpacity>
          <Text style={s.detailTitle} numberOfLines={1}>
            {selected.name}
          </Text>
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

          <TouchableOpacity
            style={s.enterBtn}
            onPress={() => handleEnter(selected)}
            activeOpacity={0.85}
          >
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
                  <Text style={s.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={s.tagBadge}>
                    <Text style={s.tagText}>{item.tag}</Text>
                  </View>
                </View>
                <Text style={s.desc} numberOfLines={2}>
                  {item.desc}
                </Text>
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
              <Text style={s.footMeta}>
                {item.members.length} 成员 · {item.messages} 消息
              </Text>
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
  container: { flex: 1, backgroundColor: tokens.surface.light },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: tokens.text.primary },
  headerSub: { marginTop: 4, fontSize: 12, color: tokens.text.secondary },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    padding: 4,
    borderRadius: 10,
    backgroundColor: tokens.surface.card,
  },
  tabItem: { flex: 1, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabItemActive: { backgroundColor: tokens.surface.light },
  tabText: { fontSize: 13, color: tokens.text.secondary },
  tabTextActive: { color: tokens.text.primary, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 13, color: tokens.text.tertiary },
  card: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: tokens.border.light },
  cardHead: { flexDirection: 'row' },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: tokens.indigo.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardIconText: { fontSize: 18, fontWeight: '600', color: tokens.indigo.deep },
  cardMain: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: tokens.text.primary },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: tokens.purple.light,
  },
  tagText: { fontSize: 11, color: tokens.purple.DEFAULT },
  desc: { marginTop: 4, fontSize: 12, color: tokens.text.secondary, lineHeight: 18 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  memberPreview: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: tokens.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: tokens.surface.light,
  },
  miniAvatarText: { fontSize: 10, fontWeight: '600', color: tokens.text.secondary },
  moreText: { marginLeft: 4, fontSize: 11, color: tokens.text.tertiary },
  footMeta: { fontSize: 11, color: tokens.text.tertiary },
  enterMiniBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 8,
    backgroundColor: tokens.purple.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enterMiniText: { fontSize: 12, fontWeight: '600', color: tokens.surface.light },
  detailHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: tokens.surface.card,
    borderBottomWidth: 1,
  },
  backText: { fontSize: 14, color: tokens.purple.DEFAULT, marginRight: 12 },
  detailTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: tokens.text.primary },
  detailBody: { flex: 1 },
  detailDesc: { fontSize: 13, color: tokens.gray[600], lineHeight: 20 },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  metaText: { fontSize: 11, color: tokens.text.tertiary },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: tokens.surface.muted,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: tokens.indigo.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  memberAvatarText: { fontSize: 14, fontWeight: '600', color: tokens.indigo.deep },
  memberMain: { flex: 1 },
  memberName: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
  memberRole: { marginTop: 2, fontSize: 11, color: tokens.text.tertiary },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: tokens.purple.light,
  },
  roleBadgeText: { fontSize: 11, color: tokens.purple.DEFAULT },
  previewBubble: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: tokens.surface.card,
    marginBottom: 8,
  },
  previewName: { fontSize: 11, color: tokens.purple.DEFAULT, fontWeight: '600', marginBottom: 4 },
  previewText: { fontSize: 13, color: tokens.text.medium, lineHeight: 18 },
  previewBubbleMine: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: tokens.purple.DEFAULT,
    alignSelf: 'flex-end',
    maxWidth: '80%',
    marginBottom: 8,
  },
  previewTextMine: { fontSize: 13, color: tokens.surface.light, lineHeight: 18 },
  enterBtn: {
    marginTop: 16,
    height: 44,
    borderRadius: 10,
    backgroundColor: tokens.purple.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enterBtnText: { fontSize: 14, fontWeight: '600', color: tokens.surface.light },
})
