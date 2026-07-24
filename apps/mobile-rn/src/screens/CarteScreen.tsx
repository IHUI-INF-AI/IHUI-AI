import { useState } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface Creator {
  name: string
  title: string
  bio: string
  projects: number
  skills: number
  rating: number
}

interface Work {
  id: string
  title: string
  category: string
  desc: string
  tags: string[]
  likes: number
}

const MOCK_CREATOR: Creator = {
  name: '陈创客',
  title: '全栈工程师 · AI 应用开发者',
  bio: '专注 AI Agent 应用与跨端开发,擅长将大模型能力落地为可用的产品。',
  projects: 24,
  skills: 12,
  rating: 4.9,
}

const SKILLS = ['React Native', 'LangGraph', 'RAG', 'Prompt 工程', 'Node.js', 'PostgreSQL', 'Taro', 'Python']

const MOCK_WORKS: Work[] = [
  { id: '1', title: '智能客服 Agent', category: 'AI 应用', desc: '基于 LangGraph 的多轮对话客服系统,支持工单流转与知识库检索。', tags: ['LangGraph', 'RAG'], likes: 128 },
  { id: '2', title: '跨端笔记应用', category: '移动开发', desc: 'React Native + Next.js 同构笔记,支持 Markdown 与双向链接。', tags: ['RN', 'Next.js'], likes: 96 },
  { id: '3', title: '数据看板可视化', category: '前端工程', desc: '复杂数据的多维可视化看板,支持自定义图表与实时刷新。', tags: ['ECharts', 'React'], likes: 72 },
  { id: '4', title: '小程序商城', category: '移动开发', desc: 'Taro 4 多端商城,统一代码覆盖微信 / 支付宝 / H5。', tags: ['Taro', 'TS'], likes: 64 },
]

const PRIMARY = '#10B981'

function initials(name: string): string {
  return name ? name.slice(0, 1).toUpperCase() : '?'
}

/** 创客名片 / 作品集:展示创客资料、技能标签与代表案例。 */
export default function CarteScreen() {
  const navigation = useNavigation<NavigationProp>()
  const [creator] = useState<Creator>(MOCK_CREATOR)
  const [works] = useState<Work[]>(MOCK_WORKS)

  const stats = [
    { label: '项目', value: creator.projects },
    { label: '技能', value: creator.skills },
    { label: '好评', value: creator.rating },
  ]

  return (
    <FlatList
      style={styles.container}
      data={works}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backText}>返回</Text>
            </TouchableOpacity>
            <Text style={styles.title}>创客名片</Text>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>{initials(creator.name)}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{creator.name}</Text>
              <Text style={styles.creatorTitle}>{creator.title}</Text>
            </View>
          </View>
          <Text style={styles.bio}>{creator.bio}</Text>

          <View style={styles.statsRow}>
            {stats.map((s) => (
              <View key={s.label} style={styles.statItem}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>技能标签</Text>
          <View style={styles.tagCloud}>
            {SKILLS.map((s) => (
              <View key={s} style={styles.tag}>
                <Text style={styles.tagText}>{s}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>作品案例</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.workCard} activeOpacity={0.7}>
          <View style={styles.workCover}>
            <Text style={styles.workCoverText}>{item.category}</Text>
          </View>
          <View style={styles.workBody}>
            <Text style={styles.workTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.workDesc} numberOfLines={2}>{item.desc}</Text>
            <View style={styles.workTags}>
              {item.tags.map((tg) => (
                <View key={tg} style={styles.miniTag}>
                  <Text style={styles.miniTagText}>{tg}</Text>
                </View>
              ))}
              <Text style={styles.likes}>♥ {item.likes}</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 48, paddingBottom: 12, gap: 12 },
  backBtn: { paddingVertical: 4 },
  backText: { fontSize: 14, color: '#6B7280' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  avatarBox: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '700', color: PRIMARY },
  profileInfo: { flex: 1, marginLeft: 12 },
  name: { fontSize: 17, fontWeight: '600', color: '#111827' },
  creatorTitle: { marginTop: 2, fontSize: 12, color: PRIMARY },
  bio: { marginTop: 12, fontSize: 13, color: '#374151', lineHeight: 20 },
  statsRow: { marginTop: 12, flexDirection: 'row', padding: 12, borderRadius: 8, backgroundColor: '#F9FAFB' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  statLabel: { marginTop: 4, fontSize: 11, color: '#9CA3AF' },
  sectionTitle: { marginTop: 16, marginBottom: 8, fontSize: 14, fontWeight: '600', color: '#111827' },
  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#ECFDF5' },
  tagText: { fontSize: 12, color: PRIMARY },
  workCard: { flexDirection: 'row', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  workCover: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  workCoverText: { fontSize: 11, color: '#6B7280' },
  workBody: { flex: 1, marginLeft: 12 },
  workTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  workDesc: { marginTop: 4, fontSize: 12, color: '#6B7280', lineHeight: 18 },
  workTags: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  miniTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: '#F3F4F6' },
  miniTagText: { fontSize: 10, color: '#6B7280' },
  likes: { fontSize: 11, color: '#EF4444' },
})
