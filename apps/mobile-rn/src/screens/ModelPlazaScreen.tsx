import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native'
import { getAiModels, type AiModel } from '@ihui/api-client'
import { useI18n } from '../i18n'

type ModelType = 'text' | 'image' | 'av'

interface Provider {
  id: string
  name: string
  total: number
  desc: string
}

interface Model {
  id: string
  providerId: string
  name: string
  type: ModelType
  inputPrice: number | null
  outputPrice: number | null
  desc: string
  tags: string[]
  payMode: string
}

const TYPE_TABS: { id: 'all' | ModelType; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'text', label: '文本' },
  { id: 'image', label: '图像' },
  { id: 'av', label: '音视频' },
]

function typeBadge(t: ModelType): { text: string; color: string; bg: string } {
  if (t === 'image') return { text: '图像', color: tokens.purple.DEFAULT, bg: tokens.purple.light } // TODO: custom color #C41E7A/#FDE8F5
  if (t === 'av') return { text: '音视频', color: tokens.success.deep, bg: tokens.success.light } // TODO: custom color #2E7D32/#E8F5E9
  return { text: '文本', color: tokens.indigo.DEFAULT, bg: tokens.indigo.light } // TODO: custom color #1888EE/#E8F4FD
}

function readModelType(v: unknown): ModelType {
  return v === 'image' || v === 'av' ? v : 'text'
}

function readNumber(v: unknown): number | null {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null
}

function readString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function readStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

function mapAiModel(m: AiModel): Model {
  return {
    id: m.id,
    providerId: m.provider,
    name: m.name,
    type: readModelType(m.type),
    inputPrice: readNumber(m.inputPrice),
    outputPrice: readNumber(m.outputPrice),
    desc: m.description ?? '',
    tags: readStringArray(m.tags),
    payMode: readString(m.payMode),
  }
}

function buildProviders(models: Model[]): Provider[] {
  const map = new Map<string, Provider>()
  for (const m of models) {
    if (!map.has(m.providerId)) {
      map.set(m.providerId, { id: m.providerId, name: m.providerId, total: 0, desc: '' })
    }
    map.get(m.providerId)!.total += 1
  }
  return Array.from(map.values())
}

export default function ModelPlazaScreen() {
  const { t } = useI18n()
  const [models, setModels] = useState<Model[]>([])
  const [providerId, setProviderId] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<'all' | ModelType>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const resp = await getAiModels({ pageSize: 100 })
      if (resp.success) {
        const list = resp.data.list.map(mapAiModel)
        setModels(list)
        setProviderId((prev) => {
          if (prev && list.some((m) => m.providerId === prev)) return prev
          return list[0]?.providerId ?? ''
        })
      } else {
        setError(resp.error)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
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

  const providers = buildProviders(models)
  const currentProvider = providers.find((p) => p.id === providerId)
  const listByProvider = models.filter((m) => m.providerId === providerId)
  const filteredList = typeFilter === 'all' ? listByProvider : listByProvider.filter((m) => m.type === typeFilter)

  const handleCompare = () => Alert.alert(t('modelPlaza.compare.title'), t('modelPlaza.compare.message'))
  const handleDetail = (m: Model) => Alert.alert(t('modelPlaza.detail.title'), t('modelPlaza.detail.message', { name: m.name }))

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>模型广场</Text>
        <TouchableOpacity style={s.compareBtn} onPress={handleCompare} activeOpacity={0.85}>
          <Text style={s.compareText}>对比</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.providerScroll} contentContainerStyle={s.providerScrollContent}>
        {providers.map((p) => {
          const active = providerId === p.id
          return (
            <TouchableOpacity
              key={p.id}
              style={[s.providerTab, active && s.providerTabActive]}
              onPress={() => { setProviderId(p.id); setTypeFilter('all') }}
              activeOpacity={0.8}
            >
              <Text style={[s.providerText, active && s.providerTextActive]}>{p.name}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {currentProvider ? (
        <View style={s.providerHeader}>
          <Text style={s.providerName}>{currentProvider.name}</Text>
          <Text style={s.providerMeta}>共 {currentProvider.total} 个模型</Text>
          <Text style={s.providerDesc}>{currentProvider.desc}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={s.errorBar}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={s.typeTabs}>
        {TYPE_TABS.map((t) => {
          const active = typeFilter === t.id
          return (
            <TouchableOpacity
              key={t.id}
              style={[s.typeTab, active && s.typeTabActive]}
              onPress={() => setTypeFilter(t.id)}
              activeOpacity={0.8}
            >
              <Text style={[s.typeTabText, active && s.typeTabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <FlatList
        data={filteredList}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>{loading ? '加载中...' : error ? '加载失败,下拉刷新重试' : '暂无该类型模型'}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const tb = typeBadge(item.type)
          return (
            <TouchableOpacity style={s.modelCard} onPress={() => handleDetail(item)} activeOpacity={0.85}>
              <View style={s.cardTop}>
                <Text style={s.modelName}>{item.name}</Text>
                <View style={[s.typeBadge, { backgroundColor: tb.bg }]}>
                  <Text style={[s.typeBadgeText, { color: tb.color }]}>{tb.text}</Text>
                </View>
              </View>
              <View style={s.priceRow}>
                <Text style={s.priceLabel}>Input</Text>
                <Text style={s.priceValue}>{item.inputPrice !== null ? `¥${item.inputPrice}/M` : '-'}</Text>
                {item.outputPrice !== null ? (
                  <>
                    <Text style={s.priceDivider}>|</Text>
                    <Text style={s.priceLabel}>Output</Text>
                    <Text style={s.priceValue}>¥{item.outputPrice}/M</Text>
                  </>
                ) : (
                  <Text style={s.priceExtra}>(按次计费)</Text>
                )}
              </View>
              <Text style={s.cardDesc} numberOfLines={2}>{item.desc}</Text>
              <View style={s.cardTagRow}>
                {item.tags.map((t) => (
                  <View key={t} style={s.cardTag}>
                    <Text style={s.cardTagText}>{t}</Text>
                  </View>
                ))}
                {item.payMode ? <Text style={s.payMode}>{item.payMode}</Text> : null}
              </View>
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.muted }, // TODO: custom color #F8F9FA
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: tokens.surface.bg },
  headerTitle: { fontSize: 20, fontWeight: '700', color: tokens.text.primary },
  compareBtn: { paddingHorizontal: 12, height: 30, borderRadius: 8, borderWidth: 1, borderColor: tokens.purple.DEFAULT, alignItems: 'center', justifyContent: 'center' },
  compareText: { fontSize: 12, fontWeight: '600', color: tokens.purple.DEFAULT },
  providerScroll: { maxHeight: 44, backgroundColor: tokens.surface.bg },
  providerScrollContent: { paddingHorizontal: 16, gap: 8, paddingVertical: 6 },
  providerTab: { paddingHorizontal: 14, height: 32, borderRadius: 8, backgroundColor: tokens.surface.card, alignItems: 'center', justifyContent: 'center' },
  providerTabActive: { backgroundColor: tokens.indigo.light },
  providerText: { fontSize: 13, color: tokens.text.secondary },
  providerTextActive: { color: tokens.indigo.deep, fontWeight: '600' },
  providerHeader: { padding: 16, backgroundColor: tokens.surface.bg },
  providerName: { fontSize: 16, fontWeight: '600', color: tokens.text.primary },
  providerMeta: { marginTop: 4, fontSize: 11, color: tokens.text.tertiary },
  providerDesc: { marginTop: 6, fontSize: 12, color: tokens.text.secondary, lineHeight: 18 },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: tokens.surface.bg },
  errorText: { fontSize: 12, color: tokens.danger.bright },
  typeTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: tokens.surface.bg },
  typeTab: { paddingHorizontal: 12, height: 30, borderRadius: 8, backgroundColor: tokens.surface.card, alignItems: 'center', justifyContent: 'center' },
  typeTabActive: { backgroundColor: tokens.purple.DEFAULT },
  typeTabText: { fontSize: 12, color: tokens.text.secondary },
  typeTabTextActive: { color: tokens.surface.light, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 13, color: tokens.text.tertiary },
  modelCard: { padding: 12, borderRadius: 12, backgroundColor: tokens.surface.bg },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  modelName: { fontSize: 15, fontWeight: '600', color: tokens.text.primary },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  priceLabel: { fontSize: 11, color: tokens.text.tertiary },
  priceValue: { fontSize: 12, color: tokens.indigo.DEFAULT, fontWeight: '600' }, // TODO: custom color #1888EE
  priceDivider: { fontSize: 11, color: tokens.border.medium, marginHorizontal: 4 },
  priceExtra: { fontSize: 11, color: tokens.text.tertiary },
  cardDesc: { fontSize: 12, color: tokens.text.secondary, lineHeight: 18, marginBottom: 8 },
  cardTagRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  cardTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: tokens.surface.card },
  cardTagText: { fontSize: 11, color: tokens.text.secondary },
  payMode: { marginLeft: 'auto', fontSize: 11, color: tokens.text.tertiary },
})
