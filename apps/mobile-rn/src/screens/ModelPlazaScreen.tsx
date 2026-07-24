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

const PROVIDERS: Provider[] = [
  { id: 'openai', name: 'OpenAI', total: 6, desc: 'GPT 系列多模态旗舰,推理与创作领先' },
  { id: 'anthropic', name: 'Anthropic', total: 4, desc: 'Claude 系列长文本与代码能力突出' },
  { id: 'google', name: 'Google', total: 5, desc: 'Gemini 全模态原生支持,多语言强' },
  { id: 'zhipu', name: 'Zhipu AI', total: 4, desc: 'GLM 系列中文场景表现优异' },
  { id: 'baidu', name: 'Baidu ERNIE', total: 3, desc: '文心一言中文知识与产业落地' },
  { id: 'alibaba', name: 'Alibaba Cloud', total: 4, desc: '通义千问开源生态完善' },
]

const MODELS: Model[] = [
  { id: '1', providerId: 'openai', name: 'GPT-4o', type: 'text', inputPrice: 0.03, outputPrice: 0.06, desc: '多模态旗舰,文字图像音频统一理解', tags: ['多模态', '推理'], payMode: '按量计费' },
  { id: '2', providerId: 'openai', name: 'GPT-4o mini', type: 'text', inputPrice: 0.002, outputPrice: 0.008, desc: '高性价比轻量版,适合大规模调用', tags: ['轻量', '低成本'], payMode: '按量计费' },
  { id: '3', providerId: 'openai', name: 'DALL·E 3', type: 'image', inputPrice: 0.04, outputPrice: null, desc: '提示词生成高质量图像,支持多种风格', tags: ['绘画', '高清'], payMode: '按张计费' },
  { id: '4', providerId: 'anthropic', name: 'Claude 3.5 Sonnet', type: 'text', inputPrice: 0.003, outputPrice: 0.015, desc: '200K 上下文,代码与长文档分析强', tags: ['长上下文', '代码'], payMode: '按量计费' },
  { id: '5', providerId: 'anthropic', name: 'Claude 3 Opus', type: 'text', inputPrice: 0.015, outputPrice: 0.075, desc: '旗舰版,复杂推理与创作能力顶级', tags: ['旗舰', '推理'], payMode: '按量计费' },
  { id: '6', providerId: 'google', name: 'Gemini 1.5 Pro', type: 'text', inputPrice: 0.0035, outputPrice: 0.0105, desc: '1M 超长上下文,多模态原生支持', tags: ['超长上下文', '多模态'], payMode: '按量计费' },
  { id: '7', providerId: 'google', name: 'Gemini 1.5 Flash', type: 'text', inputPrice: 0.0005, outputPrice: 0.0015, desc: '极速响应,适合实时对话与高并发', tags: ['快速', '高并发'], payMode: '按量计费' },
  { id: '8', providerId: 'zhipu', name: 'GLM-4-Plus', type: 'text', inputPrice: 0.05, outputPrice: 0.05, desc: '智谱旗舰,中文理解与工具调用优秀', tags: ['中文', '工具调用'], payMode: '按量计费' },
  { id: '9', providerId: 'zhipu', name: 'CogView-3', type: 'image', inputPrice: 0.1, outputPrice: null, desc: '中文 Prompt 图像生成,国风专长', tags: ['绘画', '国风'], payMode: '按张计费' },
  { id: '10', providerId: 'baidu', name: 'ERNIE 4.0', type: 'text', inputPrice: 0.12, outputPrice: 0.12, desc: '文心旗舰,中文知识与产业应用强', tags: ['中文', '产业'], payMode: '按量计费' },
  { id: '11', providerId: 'alibaba', name: 'Qwen-Max', type: 'text', inputPrice: 0.04, outputPrice: 0.12, desc: '通义旗舰,推理与代码能力领先', tags: ['旗舰', '推理'], payMode: '按量计费' },
  { id: '12', providerId: 'alibaba', name: 'Qwen-Audio', type: 'av', inputPrice: 0.02, outputPrice: null, desc: '语音理解与生成,多语言支持', tags: ['语音', '多语言'], payMode: '按次计费' },
]

const TYPE_TABS: { id: 'all' | ModelType; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'text', label: '文本' },
  { id: 'image', label: '图像' },
  { id: 'av', label: '音视频' },
]

function typeBadge(t: ModelType): { text: string; color: string; bg: string } {
  if (t === 'image') return { text: '图像', color: '#C41E7A', bg: '#FDE8F5' }
  if (t === 'av') return { text: '音视频', color: '#2E7D32', bg: '#E8F5E9' }
  return { text: '文本', color: '#1888EE', bg: '#E8F4FD' }
}

export default function ModelPlazaScreen() {
  const [providerId, setProviderId] = useState<string>('openai')
  const [typeFilter, setTypeFilter] = useState<'all' | ModelType>('all')

  const currentProvider = PROVIDERS.find((p) => p.id === providerId)
  const listByProvider = MODELS.filter((m) => m.providerId === providerId)
  const filteredList = typeFilter === 'all' ? listByProvider : listByProvider.filter((m) => m.type === typeFilter)

  if (!currentProvider) return null

  const handleCompare = () => Alert.alert('模型对比', '请选择 2-3 个模型加入对比')
  const handleDetail = (m: Model) => Alert.alert('模型详情', `查看「${m.name}」完整参数与定价`)

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>模型广场</Text>
        <TouchableOpacity style={s.compareBtn} onPress={handleCompare} activeOpacity={0.85}>
          <Text style={s.compareText}>对比</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.providerScroll} contentContainerStyle={s.providerScrollContent}>
        {PROVIDERS.map((p) => {
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

      <View style={s.providerHeader}>
        <Text style={s.providerName}>{currentProvider.name}</Text>
        <Text style={s.providerMeta}>共 {currentProvider.total} 个模型</Text>
        <Text style={s.providerDesc}>{currentProvider.desc}</Text>
      </View>

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
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>暂无该类型模型</Text>
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
                <Text style={s.priceValue}>¥{item.inputPrice}/M</Text>
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
                <Text style={s.payMode}>{item.payMode}</Text>
              </View>
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: '#FFFFFF' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  compareBtn: { paddingHorizontal: 12, height: 30, borderRadius: 8, borderWidth: 1, borderColor: '#7B61FF', alignItems: 'center', justifyContent: 'center' },
  compareText: { fontSize: 12, fontWeight: '600', color: '#7B61FF' },
  providerScroll: { maxHeight: 44, backgroundColor: '#FFFFFF' },
  providerScrollContent: { paddingHorizontal: 16, gap: 8, paddingVertical: 6 },
  providerTab: { paddingHorizontal: 14, height: 32, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  providerTabActive: { backgroundColor: '#EEF2FF' },
  providerText: { fontSize: 13, color: '#6B7280' },
  providerTextActive: { color: '#4F46E5', fontWeight: '600' },
  providerHeader: { padding: 16, backgroundColor: '#FFFFFF' },
  providerName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  providerMeta: { marginTop: 4, fontSize: 11, color: '#9CA3AF' },
  providerDesc: { marginTop: 6, fontSize: 12, color: '#6B7280', lineHeight: 18 },
  typeTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  typeTab: { paddingHorizontal: 12, height: 30, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  typeTabActive: { backgroundColor: '#7B61FF' },
  typeTabText: { fontSize: 12, color: '#6B7280' },
  typeTabTextActive: { color: '#FFFFFF', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },
  modelCard: { padding: 12, borderRadius: 12, backgroundColor: '#FFFFFF' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  modelName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  priceLabel: { fontSize: 11, color: '#9CA3AF' },
  priceValue: { fontSize: 12, color: '#1888EE', fontWeight: '600' },
  priceDivider: { fontSize: 11, color: '#D1D5DB', marginHorizontal: 4 },
  priceExtra: { fontSize: 11, color: '#9CA3AF' },
  cardDesc: { fontSize: 12, color: '#6B7280', lineHeight: 18, marginBottom: 8 },
  cardTagRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  cardTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#F3F4F6' },
  cardTagText: { fontSize: 11, color: '#6B7280' },
  payMode: { marginLeft: 'auto', fontSize: 11, color: '#9CA3AF' },
})
