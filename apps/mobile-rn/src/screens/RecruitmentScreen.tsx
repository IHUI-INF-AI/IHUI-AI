import { useState } from 'react'
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type Category = 'all' | 'tech' | 'product' | 'design' | 'ops'

interface Job {
  id: string
  position: string
  company: string
  salary: string
  location: string
  category: Exclude<Category, 'all'>
  tags: string[]
  experience: string
  education: string
  description: string
  requirements: string[]
}

const TABS: { key: Category; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'tech', label: '技术' },
  { key: 'product', label: '产品' },
  { key: 'design', label: '设计' },
  { key: 'ops', label: '运营' },
]

const MOCK_JOBS: Job[] = [
  { id: '1', position: '高级前端工程师', company: 'AI智汇社', salary: '25-40K', location: '上海', category: 'tech', tags: ['React', 'RN'], experience: '3-5年', education: '本科', description: '负责跨端 AI 应用前端架构与核心模块开发,与产品团队协作交付高质量体验。', requirements: ['精通 React / TypeScript', '熟悉 React Native 跨端开发', '有大型应用性能优化经验', '良好的工程协作意识'] },
  { id: '2', position: 'AI 产品经理', company: '智汇实验室', salary: '30-50K', location: '北京', category: 'product', tags: ['AI', 'B端'], experience: '5年以上', education: '本科', description: '主导 AI 智能体产品从 0 到 1 的规划与落地,对接客户需求与研发节奏。', requirements: ['5年以上产品经验', '熟悉 LLM / Agent 能力边界', '有 B 端 SaaS 经验优先', '出色的需求抽象能力'] },
  { id: '3', position: 'UI/UX 设计师', company: '智汇设计中心', salary: '18-30K', location: '远程', category: 'design', tags: ['UI', 'UX'], experience: '3年以上', education: '大专', description: '负责多端产品的视觉与交互设计,建立统一的设计语言与组件规范。', requirements: ['精通 Figma 等设计工具', '有跨端设计经验', '理解前端实现约束', '有设计系统建设经验优先'] },
  { id: '4', position: '内容运营专员', company: '智汇社区', salary: '10-18K', location: '杭州', category: 'ops', tags: ['内容', '社区'], experience: '1-3年', education: '本科', description: '负责社区内容生态运营,策划 AI 话题活动,提升用户活跃与留存。', requirements: ['有社区/内容运营经验', '熟悉 AI 行业动态', '较强的文案能力', '数据驱动思维'] },
  { id: '5', position: '后端架构师', company: 'AI智汇社', salary: '40-70K', location: '上海', category: 'tech', tags: ['Node', '架构'], experience: '5年以上', education: '本科', description: '负责平台后端架构演进与技术选型,保障高并发场景下的稳定性与扩展性。', requirements: ['精通 Node.js / TypeScript', '熟悉微服务架构', '有高并发系统经验', '数据库调优能力'] },
]

const PRIMARY = '#10B981'

/** 招聘列表:职位筛选 / 列表 / 详情 / 投递。 */
export default function RecruitmentScreen() {
  const navigation = useNavigation<NavigationProp>()
  const [activeTab, setActiveTab] = useState<Category>('all')
  const [selected, setSelected] = useState<Job | null>(null)
  const [applied, setApplied] = useState<Set<string>>(new Set())

  const filtered = activeTab === 'all' ? MOCK_JOBS : MOCK_JOBS.filter((j) => j.category === activeTab)

  const onApply = (job: Job) => {
    setApplied((prev) => new Set(prev).add(job.id))
    setSelected(null)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>招聘职位</Text>
        <Text style={styles.subtitle}>{filtered.length} 个职位 · 欢迎投递</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>暂无相关职位</Text></View>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.jobCard} onPress={() => setSelected(item)} activeOpacity={0.7}>
            <View style={styles.jobHead}>
              <Text style={styles.jobPosition} numberOfLines={1}>{item.position}</Text>
              <Text style={styles.jobSalary}>{item.salary}</Text>
            </View>
            <Text style={styles.jobCompany}>{item.company} · {item.location}</Text>
            <View style={styles.jobMeta}>
              <Text style={styles.jobMetaText}>{item.experience}</Text>
              <Text style={styles.jobMetaText}>{item.education}</Text>
              {item.tags.map((tg) => (
                <View key={tg} style={styles.miniTag}>
                  <Text style={styles.miniTagText}>{tg}</Text>
                </View>
              ))}
              {applied.has(item.id) ? (
                <View style={styles.appliedBadge}>
                  <Text style={styles.appliedText}>已投递</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalMask}>
          <View style={styles.modalCard}>
            {selected ? (
              <>
                <View style={styles.modalHead}>
                  <Text style={styles.modalTitle} numberOfLines={1}>{selected.position}</Text>
                  <TouchableOpacity onPress={() => setSelected(null)}>
                    <Text style={styles.modalClose}>关闭</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalSalary}>{selected.salary} · {selected.company} · {selected.location}</Text>
                <Text style={styles.modalSection}>职位描述</Text>
                <Text style={styles.modalDesc}>{selected.description}</Text>
                <Text style={styles.modalSection}>任职要求</Text>
                {selected.requirements.map((r, i) => (
                  <Text key={i} style={styles.modalReq}>· {r}</Text>
                ))}
                <TouchableOpacity
                  style={[styles.applyBtn, applied.has(selected.id) && styles.applyBtnDisabled]}
                  onPress={() => onApply(selected)}
                  disabled={applied.has(selected.id)}
                >
                  <Text style={styles.applyText}>{applied.has(selected.id) ? '已投递,等待反馈' : '立即投递'}</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backBtn: { paddingVertical: 4, marginBottom: 4 },
  backText: { fontSize: 14, color: '#6B7280' },
  title: { fontSize: 22, fontWeight: '600', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 12, color: '#9CA3AF' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: PRIMARY },
  tabText: { fontSize: 12, color: '#6B7280' },
  tabTextActive: { color: '#FFFFFF' },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9CA3AF' },
  jobCard: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  jobHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  jobPosition: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827', marginRight: 8 },
  jobSalary: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
  jobCompany: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  jobMeta: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  jobMetaText: { fontSize: 11, color: '#9CA3AF' },
  miniTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: '#F3F4F6' },
  miniTagText: { fontSize: 10, color: '#6B7280' },
  appliedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: '#ECFDF5' },
  appliedText: { fontSize: 10, color: PRIMARY },
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 32 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: '#111827', marginRight: 8 },
  modalClose: { fontSize: 14, color: '#6B7280' },
  modalSalary: { marginTop: 6, fontSize: 13, color: PRIMARY },
  modalSection: { marginTop: 16, marginBottom: 6, fontSize: 13, fontWeight: '600', color: '#111827' },
  modalDesc: { fontSize: 13, color: '#374151', lineHeight: 20 },
  modalReq: { marginTop: 4, fontSize: 13, color: '#374151', lineHeight: 20 },
  applyBtn: { marginTop: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center' },
  applyBtnDisabled: { backgroundColor: '#9CA3AF' },
  applyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
})
