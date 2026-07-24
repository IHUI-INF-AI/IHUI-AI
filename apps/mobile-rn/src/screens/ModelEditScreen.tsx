import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native'

type SaleType = 'free' | 'limited' | 'paid'
type PayCycle = 'month' | 'year' | 'permanent'
type Audience = 'all' | 'member'

const MODEL_INFO = {
  name: '文案写作助手',
  prologue: '帮你快速生成营销文案、种草笔记、短视频脚本',
}

const CATEGORY_OPTIONS = [
  { id: '1', label: '文字' },
  { id: '2', label: '图片' },
  { id: '3', label: '视频' },
]
const DEPT_OPTIONS = [
  { id: 'd1', label: '营销推广' },
  { id: 'd2', label: '教育培训' },
  { id: 'd3', label: '生活服务' },
  { id: 'd4', label: '办公效率' },
]
const FREE_DURATIONS = ['一个月', '三个月', '六个月', '一年']
const DISCOUNTS = [
  { id: '1', label: '6 个月后 8 折' },
  { id: '2', label: '9 个月后 7 折' },
  { id: '3', label: '1 年后 5 折' },
]

export default function ModelEditScreen() {
  const [categories, setCategories] = useState<string[]>(['1'])
  const [dept, setDept] = useState('d1')
  const [saleType, setSaleType] = useState<SaleType>('limited')
  const [cycle, setCycle] = useState<PayCycle>('month')
  const [price, setPrice] = useState('')
  const [freeDur, setFreeDur] = useState('一年')
  const [audience, setAudience] = useState<Audience>('all')
  const [discount, setDiscount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const toggleCategory = (id: string) =>
    setCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )

  const cycleLabel = cycle === 'month' ? '月' : cycle === 'year' ? '年' : '永久'

  const handleSubmit = () => {
    if (categories.length === 0) return Alert.alert('提示', '请选择内容种类')
    if (saleType !== 'free' && !price) return Alert.alert('提示', '请输入价格')
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      Alert.alert('提交成功', '配置已提交审核', [{ text: '知道了' }])
    }, 800)
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>设置智能体</Text>
      </View>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.baseCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{MODEL_INFO.name.charAt(0)}</Text>
          </View>
          <View style={s.baseMain}>
            <Text style={s.baseName} numberOfLines={1}>{MODEL_INFO.name}</Text>
            <Text style={s.baseSub} numberOfLines={2}>{MODEL_INFO.prologue}</Text>
          </View>
        </View>

        <Text style={s.label}>内容种类(多选)</Text>
        <View style={s.chipRow}>
          {CATEGORY_OPTIONS.map((c) => {
            const active = categories.includes(c.id)
            return (
              <TouchableOpacity
                key={c.id}
                style={[s.chip, active && s.chipActive]}
                onPress={() => toggleCategory(c.id)}
                activeOpacity={0.8}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={s.label}>部门</Text>
        <View style={s.chipRow}>
          {DEPT_OPTIONS.map((d) => {
            const active = dept === d.id
            return (
              <TouchableOpacity
                key={d.id}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setDept(d.id)}
                activeOpacity={0.8}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{d.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={s.label}>售卖方式</Text>
        <View style={s.chipRow}>
          {(
            [
              { id: 'free', label: '免费' },
              { id: 'limited', label: '限时免费' },
              { id: 'paid', label: '收费' },
            ] as { id: SaleType; label: string }[]
          ).map((t) => {
            const active = saleType === t.id
            return (
              <TouchableOpacity
                key={t.id}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setSaleType(t.id)}
                activeOpacity={0.8}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {saleType !== 'free' && (
          <View style={s.paidCard}>
            <Text style={s.label}>收费周期</Text>
            <View style={s.chipRow}>
              {(
                [
                  { id: 'month', label: '按月' },
                  { id: 'year', label: '按年' },
                  { id: 'permanent', label: '永久' },
                ] as { id: PayCycle; label: string }[]
              ).map((c) => {
                const active = cycle === c.id
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setCycle(c.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <Text style={s.label}>价格(元 / {cycleLabel})</Text>
            <View style={s.priceRow}>
              <Text style={s.priceUnit}>¥</Text>
              <TextInput
                style={s.priceInput}
                value={price}
                onChangeText={setPrice}
                placeholder="请输入价格"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>
            {saleType === 'limited' && (
              <>
                <Text style={s.label}>限时免费时限</Text>
                <View style={s.chipRow}>
                  {FREE_DURATIONS.map((d) => {
                    const active = freeDur === d
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[s.chip, active && s.chipActive]}
                        onPress={() => setFreeDur(d)}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.chipText, active && s.chipTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </>
            )}
            <Text style={s.label}>是否参与折扣</Text>
            <View style={s.chipRow}>
              {DISCOUNTS.map((d) => {
                const active = discount === d.id
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setDiscount(active ? '' : d.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>{d.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}

        <Text style={s.label}>面向群体</Text>
        <View style={s.chipRow}>
          {(
            [
              { id: 'all', label: '全部用户' },
              { id: 'member', label: '会员' },
            ] as { id: Audience; label: string }[]
          ).map((a) => {
            const active = audience === a.id
            return (
              <TouchableOpacity
                key={a.id}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setAudience(a.id)}
                activeOpacity={0.8}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{a.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity
          style={[s.btn, submitting && s.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <Text style={s.btnText}>{submitting ? '提交中...' : '提交审核'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  body: { padding: 16, paddingBottom: 32 },
  baseCard: { flexDirection: 'row', marginBottom: 8 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 20, fontWeight: '600', color: '#7B61FF' },
  baseMain: { flex: 1 },
  baseName: { fontSize: 15, fontWeight: '600', color: '#517BFF' },
  baseSub: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { borderColor: '#7B61FF', backgroundColor: '#FAF9FF' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextActive: { color: '#7B61FF', fontWeight: '600' },
  paidCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9F8FF',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  priceUnit: { fontSize: 18, fontWeight: '600', color: '#7B61FF', marginRight: 8 },
  priceInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#111827' },
  btn: {
    marginTop: 28,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
})
