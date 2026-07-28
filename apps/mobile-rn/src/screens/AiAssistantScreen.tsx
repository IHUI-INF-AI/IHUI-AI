import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native'
import { getAgents, type Agent } from '@ihui/api-client'

type Category = 'all' | 'writing' | 'coding' | 'office' | 'study'

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'writing', label: '写作' },
  { id: 'coding', label: '编程' },
  { id: 'office', label: '办公' },
  { id: 'study', label: '学习' },
]

function formatNum(n: number): string {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : `${n}`
}

export default function AiAssistantScreen() {
  const [category, setCategory] = useState<Category>('all')
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const resp = await getAgents({ status: 'published' })
      if (!resp.success) throw new Error(resp.error)
      setItems(resp.data.list ?? [])
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

  const list = items.filter((a) => {
    if (category !== 'all' && a.category !== category) return false
    return keyword ? a.name.includes(keyword) || a.description.includes(keyword) : true
  })

  // TODO: i18n — Alert.alert 硬编码中文待翻译(进入对话 / 即将与「X」开始对话)
  const handleChat = (a: Agent) => Alert.alert('进入对话', `即将与「${a.name}」开始对话`)

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>AI 助手</Text>
        <Text style={s.headerSub}>选择智能助手,开启高效对话</Text>
      </View>

      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={keyword}
          onChangeText={setKeyword}
          placeholder="搜索助手名称或能力"
          placeholderTextColor={tokens.text.tertiary}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.catScroll}
        contentContainerStyle={s.catScrollContent}
      >
        {CATEGORIES.map((c) => {
          const active = category === c.id
          return (
            <TouchableOpacity
              key={c.id}
              style={[s.catItem, active && s.catItemActive]}
              onPress={() => setCategory(c.id)}
              activeOpacity={0.8}
            >
              <Text style={[s.catText, active && s.catTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {error ? (
        <View style={s.errorBar}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          loading ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>加载中...</Text>
            </View>
          ) : (
            <View style={s.empty}>
              <Text style={s.emptyText}>暂无匹配的助手</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} onPress={() => handleChat(item)} activeOpacity={0.85}>
            <View style={s.cardHead}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{item.name.charAt(0)}</Text>
              </View>
              <View style={s.cardMain}>
                <Text style={s.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={s.desc} numberOfLines={2}>
                  {item.description}
                </Text>
              </View>
            </View>
            <View style={s.tagRow}>
              {item.tags.map((t) => (
                <View key={t} style={s.tag}>
                  <Text style={s.tagText}>{t}</Text>
                </View>
              ))}
            </View>
            <View style={s.cardFoot}>
              <Text style={s.metaText}>使用 {formatNum(item.useCount)}</Text>
              <Text style={s.metaText}>点赞 {formatNum(item.favoriteCount)}</Text>
              <View style={s.ctaBtn}>
                <Text style={s.ctaText}>开始对话</Text>
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
  searchRow: { paddingHorizontal: 16, marginTop: 4 },
  searchInput: {
    height: 38,
    borderWidth: 1,
    borderColor: tokens.border.light,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: tokens.text.primary,
    backgroundColor: tokens.surface.muted,
  },
  catScroll: { marginTop: 12, maxHeight: 40 },
  catScrollContent: { paddingHorizontal: 16, gap: 8 },
  catItem: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catItemActive: { backgroundColor: tokens.purple.DEFAULT },
  catText: { fontSize: 13, color: tokens.text.secondary },
  catTextActive: { color: tokens.surface.light, fontWeight: '600' },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: tokens.danger.light },
  errorText: { fontSize: 12, color: tokens.danger.DEFAULT },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 13, color: tokens.text.tertiary },
  card: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: tokens.border.light },
  cardHead: { flexDirection: 'row' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: tokens.purple.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { fontSize: 18, fontWeight: '600', color: tokens.purple.DEFAULT },
  cardMain: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: tokens.text.primary },
  desc: { marginTop: 4, fontSize: 12, color: tokens.text.secondary, lineHeight: 18 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: tokens.surface.card,
  },
  tagText: { fontSize: 11, color: tokens.text.secondary },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  metaText: { fontSize: 11, color: tokens.text.tertiary },
  ctaBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 8,
    backgroundColor: tokens.purple.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 12, fontWeight: '600', color: tokens.surface.light },
})
