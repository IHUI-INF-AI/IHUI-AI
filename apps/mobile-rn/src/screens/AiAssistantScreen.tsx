import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native'

type Category = 'all' | 'writing' | 'coding' | 'office' | 'study'

interface Assistant {
  id: string
  name: string
  desc: string
  category: Exclude<Category, 'all'>
  usage: number
  likes: number
  tags: string[]
}

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'writing', label: '写作' },
  { id: 'coding', label: '编程' },
  { id: 'office', label: '办公' },
  { id: 'study', label: '学习' },
]

const MOCK: Assistant[] = [
  { id: '1', name: '文案大师', desc: '营销文案、种草笔记、爆款标题一键生成', category: 'writing', usage: 12834, likes: 892, tags: ['种草', '标题'] },
  { id: '2', name: '代码助手', desc: '多语言代码生成、Bug 修复、单元测试', category: 'coding', usage: 9821, likes: 1203, tags: ['Python', 'TS'] },
  { id: '3', name: 'PPT 工匠', desc: '输入主题自动生成大纲与排版', category: 'office', usage: 6402, likes: 567, tags: ['PPT', '大纲'] },
  { id: '4', name: '英语陪练', desc: 'AI 外教 24h 一对一口语练习', category: 'study', usage: 4521, likes: 743, tags: ['口语', '雅思'] },
  { id: '5', name: '周报生成器', desc: '流水账秒变结构化周报', category: 'office', usage: 3892, likes: 412, tags: ['周报', '汇报'] },
  { id: '6', name: '论文润色', desc: '学术写作语法矫正与表达提升', category: 'writing', usage: 2734, likes: 328, tags: ['学术', '润色'] },
]

function formatNum(n: number): string {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : `${n}`
}

export default function AiAssistantScreen() {
  const [category, setCategory] = useState<Category>('all')
  const [keyword, setKeyword] = useState('')

  const list = MOCK.filter((a) => {
    if (category !== 'all' && a.category !== category) return false
    return keyword ? a.name.includes(keyword) || a.desc.includes(keyword) : true
  })

  const handleChat = (a: Assistant) =>
    Alert.alert('进入对话', `即将与「${a.name}」开始对话`)

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
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll} contentContainerStyle={s.catScrollContent}>
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

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>暂无匹配的助手</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} onPress={() => handleChat(item)} activeOpacity={0.85}>
            <View style={s.cardHead}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{item.name.charAt(0)}</Text>
              </View>
              <View style={s.cardMain}>
                <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                <Text style={s.desc} numberOfLines={2}>{item.desc}</Text>
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
              <Text style={s.metaText}>使用 {formatNum(item.usage)}</Text>
              <Text style={s.metaText}>点赞 {formatNum(item.likes)}</Text>
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  headerSub: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  searchRow: { paddingHorizontal: 16, marginTop: 4 },
  searchInput: { height: 38, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, fontSize: 13, color: '#111827', backgroundColor: '#F9FAFB' },
  catScroll: { marginTop: 12, maxHeight: 40 },
  catScrollContent: { paddingHorizontal: 16, gap: 8 },
  catItem: { paddingHorizontal: 14, height: 32, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  catItemActive: { backgroundColor: '#7B61FF' },
  catText: { fontSize: 13, color: '#6B7280' },
  catTextActive: { color: '#FFFFFF', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },
  card: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHead: { flexDirection: 'row' },
  avatar: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { fontSize: 18, fontWeight: '600', color: '#7B61FF' },
  cardMain: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#111827' },
  desc: { marginTop: 4, fontSize: 12, color: '#6B7280', lineHeight: 18 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#F3F4F6' },
  tagText: { fontSize: 11, color: '#6B7280' },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  metaText: { fontSize: 11, color: '#9CA3AF' },
  ctaBtn: { marginLeft: 'auto', paddingHorizontal: 14, height: 30, borderRadius: 8, backgroundColor: '#7B61FF', alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
})
