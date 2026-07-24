import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native'

interface PayPlan {
  type: 'month' | 'year'
  label: string
  price: number
  unit: string
  perks: string[]
}

const PLANS: PayPlan[] = [
  {
    type: 'month',
    label: '开发者包月',
    price: 100,
    unit: '月',
    perks: ['智能体上架 10 个', '收益结算 T+1', '基础数据分析'],
  },
  {
    type: 'year',
    label: '开发者包年',
    price: 1000,
    unit: '年',
    perks: ['智能体上架 100 个', '收益结算 T+0', '高级数据分析', '专属客服'],
  },
]

const FEATURES = [
  { title: '上架智能体', desc: '创建并发布你的 AI 助手' },
  { title: '收益分成', desc: '限时 0 服务费,全额到账' },
  { title: '数据分析', desc: '实时查看调用与收益' },
  { title: 'n8n 工作流', desc: '接入 n8n 自动化能力' },
]

export default function DeveloperScreen() {
  const [selected, setSelected] = useState<PayPlan['type']>('year')
  const [submitting, setSubmitting] = useState(false)

  const handleOpen = () => {
    setSubmitting(true)
    setTimeout(() => setSubmitting(false), 800)
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>开发者入口</Text>
      </View>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.cover}>
          <Text style={s.coverTitle}>成为开发者</Text>
          <Text style={s.coverSub}>发布智能体,获取收益</Text>
          <View style={s.featureGrid}>
            {FEATURES.map((f) => (
              <View key={f.title} style={s.featureItem}>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureDesc} numberOfLines={2}>
                  {f.desc}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={s.sectionLabel}>请选择所需要的服务</Text>
        <View style={s.planRow}>
          {PLANS.map((p) => {
            const active = selected === p.type
            return (
              <TouchableOpacity
                key={p.type}
                style={[s.planCard, active && s.planCardActive]}
                onPress={() => setSelected(p.type)}
                activeOpacity={0.8}
              >
                <Text style={[s.planLabel, active && s.planLabelActive]}>{p.label}</Text>
                <Text style={[s.planPrice, active && s.planPriceActive]}>
                  <Text style={s.planPriceNum}>{p.price}</Text>
                  <Text style={s.planPriceUnit}> / {p.unit}</Text>
                </Text>
                <View style={s.perkWrap}>
                  {p.perks.map((perk) => (
                    <Text key={perk} style={[s.perkText, active && s.perkTextActive]} numberOfLines={1}>
                      · {perk}
                    </Text>
                  ))}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity
          style={[s.btn, submitting && s.btnDisabled]}
          onPress={handleOpen}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <Text style={s.btnText}>{submitting ? '处理中...' : '一键开通'}</Text>
        </TouchableOpacity>
        <Text style={s.tip}>开通即表示同意《开发者服务协议》</Text>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  body: { padding: 16, paddingBottom: 32 },
  cover: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  coverTitle: { fontSize: 20, fontWeight: '700', color: '#7B61FF' },
  coverSub: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  featureGrid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureItem: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 8, padding: 10 },
  featureTitle: { fontSize: 13, fontWeight: '600', color: '#111827' },
  featureDesc: { marginTop: 2, fontSize: 11, color: '#9CA3AF' },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 },
  planRow: { flexDirection: 'row', gap: 12 },
  planCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  planCardActive: { borderColor: '#7B61FF', backgroundColor: '#FAF9FF' },
  planLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  planLabelActive: { color: '#7B61FF' },
  planPrice: { marginTop: 8, color: '#111827' },
  planPriceActive: { color: '#7B61FF' },
  planPriceNum: { fontSize: 24, fontWeight: '700' },
  planPriceUnit: { fontSize: 12, color: '#9CA3AF' },
  perkWrap: { marginTop: 10, gap: 4 },
  perkText: { fontSize: 11, color: '#6B7280' },
  perkTextActive: { color: '#7B61FF' },
  btn: {
    marginTop: 24,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#7B61FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  tip: { marginTop: 12, textAlign: 'center', fontSize: 11, color: '#9CA3AF' },
})
