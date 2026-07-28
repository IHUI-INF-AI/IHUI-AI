import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { tokens } from '@ihui/rn-app'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAiCareers, type AiCareerItem } from '@ihui/api-client'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 安全提取 AiCareerItem 上 index signature 为 unknown 的字符串字段。 */
const getStringField = (item: AiCareerItem, field: string): string => {
  const v: unknown = item[field]
  return typeof v === 'string' ? v : ''
}

const PRIMARY = tokens.brand.DEFAULT

/** 招聘列表:职位列表 / 详情 / 投递。 */
export default function RecruitmentScreen() {
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<AiCareerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<AiCareerItem | null>(null)

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError('')
    try {
      const resp = await getAiCareers({ page: 1, pageSize: 50 })
      if (resp.success) {
        setItems(resp.data.list)
      } else {
        setError(resp.error || '加载失败')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      if (isRefresh) {
        setRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const onApply = () => {
    Alert.alert('提示', '投递功能待接入')
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>招聘职位</Text>
        <Text style={styles.subtitle}>{items.length} 个职位 · 欢迎投递</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadData(true)} />
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{loading ? '加载中...' : error || '暂无相关职位'}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const company = getStringField(item, 'company')
          const salary = getStringField(item, 'salary')
          const location = getStringField(item, 'location')
          const meta = [company, location].filter(Boolean).join(' · ')
          return (
            <TouchableOpacity
              style={styles.jobCard}
              onPress={() => setSelected(item)}
              activeOpacity={0.7}
            >
              <View style={styles.jobHead}>
                <Text style={styles.jobPosition} numberOfLines={1}>
                  {item.title}
                </Text>
                {salary ? <Text style={styles.jobSalary}>{salary}</Text> : null}
              </View>
              {meta ? <Text style={styles.jobCompany}>{meta}</Text> : null}
              {item.description ? (
                <Text style={styles.jobDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
            </TouchableOpacity>
          )
        }}
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
                    {selected.title}
                  </Text>
                  <TouchableOpacity onPress={() => setSelected(null)}>
                    <Text style={styles.modalClose}>关闭</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalSalary}>
                  {[
                    getStringField(selected, 'salary'),
                    getStringField(selected, 'company'),
                    getStringField(selected, 'location'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {selected.description ? (
                  <>
                    <Text style={styles.modalSection}>职位描述</Text>
                    <Text style={styles.modalDesc}>{selected.description}</Text>
                  </>
                ) : null}
                <TouchableOpacity style={styles.applyBtn} onPress={onApply}>
                  <Text style={styles.applyText}>立即投递</Text>
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
  jobSalary: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
  jobCompany: { marginTop: 4, fontSize: 12, color: tokens.text.secondary },
  jobDesc: { marginTop: 6, fontSize: 12, color: tokens.text.tertiary, lineHeight: 18 },
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
    backgroundColor: '#ECFDF5',
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
