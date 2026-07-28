import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useEffect, useState } from 'react'
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAiCareers, type AiCareerItem } from '@ihui/api-client'
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

const PRIMARY = tokens.brand.DEFAULT

/** Map backend category string to local TABS category, default 'tech' if unmatched */
function parseCategory(raw: string | undefined): Exclude<Category, 'all'> {
  if (raw === 'tech' || raw === 'product' || raw === 'design' || raw === 'ops') return raw
  return 'tech'
}

/** AiCareerItem -> Job field mapping (strongly typed, backend fields are explicit) */
function mapCareerToJob(item: AiCareerItem): Job {
  return {
    id: item.id,
    position: item.title,
    company: item.company || '—',
    salary: item.salary || '面议',
    location: item.location || '—',
    category: parseCategory(item.category),
    tags: item.tags ?? [],
    experience: item.experience || '—',
    education: item.education || '—',
    description: item.description ?? item.content ?? '',
    requirements: item.requirements ?? [],
  }
}

/** 招聘列表:职位筛选 / 列表 / 详情 / 投递。 */
export default function RecruitmentScreen() {
  const navigation = useNavigation<NavigationProp>()
  const [activeTab, setActiveTab] = useState<Category>('all')
  const [selected, setSelected] = useState<Job | null>(null)
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 从 @ihui/api-client 加载真实招聘数据,替换原 MOCK_JOBS。
  // cancelled flag 防止组件卸载后 setState 导致内存泄漏。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await getAiCareers({ page: 1, pageSize: 50 })
        if (cancelled) return
        if (res.success) {
          setJobs(res.data.list.map(mapCareerToJob))
        } else {
          setError(res.error || '加载失败')
        }
      } catch {
        if (!cancelled) setError('加载失败,请稍后重试')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Real category filter: 'all' shows everything, others filter by job.category
  const filtered = activeTab === 'all' ? jobs : jobs.filter((j) => j.category === activeTab)

  const onApply = (job: Job) => {
    setApplied((prev) => new Set(prev).add(job.id))
    setSelected(null)
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.stateWrap}>
          <Text style={styles.stateText}>加载中...</Text>
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.stateWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    )
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
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无相关职位</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.jobCard}
            onPress={() => setSelected(item)}
            activeOpacity={0.7}
          >
            <View style={styles.jobHead}>
              <Text style={styles.jobPosition} numberOfLines={1}>
                {item.position}
              </Text>
              <Text style={styles.jobSalary}>{item.salary}</Text>
            </View>
            <Text style={styles.jobCompany}>
              {item.company} · {item.location}
            </Text>
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

      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalMask}>
          <View style={styles.modalCard}>
            {selected ? (
              <>
                <View style={styles.modalHead}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {selected.position}
                  </Text>
                  <TouchableOpacity onPress={() => setSelected(null)}>
                    <Text style={styles.modalClose}>关闭</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalSalary}>
                  {selected.salary} · {selected.company} · {selected.location}
                </Text>
                <Text style={styles.modalSection}>职位描述</Text>
                <Text style={styles.modalDesc}>{selected.description}</Text>
                <Text style={styles.modalSection}>任职要求</Text>
                {selected.requirements.map((r, i) => (
                  <Text key={i} style={styles.modalReq}>
                    · {r}
                  </Text>
                ))}
                <TouchableOpacity
                  style={[styles.applyBtn, applied.has(selected.id) && styles.applyBtnDisabled]}
                  onPress={() => onApply(selected)}
                  disabled={applied.has(selected.id)}
                >
                  <Text style={styles.applyText}>
                    {applied.has(selected.id) ? '已投递,等待反馈' : '立即投递'}
                  </Text>
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
  container: { flex: 1, backgroundColor: tokens.surface.light },
  stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  stateText: { fontSize: 13, color: tokens.text.tertiary },
  errorText: { fontSize: 13, color: tokens.danger.DEFAULT },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backBtn: { paddingVertical: 4, marginBottom: 4 },
  backText: { fontSize: 14, color: tokens.text.secondary },
  title: { fontSize: 22, fontWeight: '600', color: tokens.text.primary },
  subtitle: { marginTop: 4, fontSize: 12, color: tokens.text.tertiary },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
  },
  tabActive: { backgroundColor: PRIMARY },
  tabText: { fontSize: 12, color: tokens.text.secondary },
  tabTextActive: { color: tokens.surface.light },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: tokens.text.tertiary },
  jobCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.light,
  },
  jobHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  jobPosition: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: tokens.text.primary,
    marginRight: 8,
  },
  jobSalary: { fontSize: 14, fontWeight: '600', color: tokens.danger.bright },
  jobCompany: { marginTop: 4, fontSize: 12, color: tokens.text.secondary },
  jobMeta: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  jobMetaText: { fontSize: 11, color: tokens.text.tertiary },
  miniTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
  },
  miniTagText: { fontSize: 10, color: tokens.text.secondary },
  appliedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: tokens.success.light,
  },
  appliedText: { fontSize: 10, color: PRIMARY },
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: tokens.surface.light,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32,
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: tokens.text.primary,
    marginRight: 8,
  },
  modalClose: { fontSize: 14, color: tokens.text.secondary },
  modalSalary: { marginTop: 6, fontSize: 13, color: PRIMARY },
  modalSection: {
    marginTop: 16,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  modalDesc: { fontSize: 13, color: tokens.text.medium, lineHeight: 20 },
  modalReq: { marginTop: 4, fontSize: 13, color: tokens.text.medium, lineHeight: 20 },
  applyBtn: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: PRIMARY,
    alignItems: 'center',
  },
  applyBtnDisabled: { backgroundColor: tokens.text.tertiary },
  applyText: { color: tokens.surface.light, fontSize: 15, fontWeight: '600' },
})
