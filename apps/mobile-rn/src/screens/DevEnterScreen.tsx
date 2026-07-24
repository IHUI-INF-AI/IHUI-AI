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

type DevType = 'personal' | 'enterprise'
type Field = 'tech' | 'education' | 'finance' | 'content' | 'other'

const FIELD_OPTIONS: { id: Field; label: string }[] = [
  { id: 'tech', label: '技术服务' },
  { id: 'education', label: '教育培训' },
  { id: 'finance', label: '金融财税' },
  { id: 'content', label: '内容创作' },
  { id: 'other', label: '其他' },
]

export default function DevEnterScreen() {
  const [devType, setDevType] = useState<DevType>('personal')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [field, setField] = useState<Field>('tech')
  const [intro, setIntro] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = () => {
    if (!name.trim()) return Alert.alert('提示', '请输入开发者名称')
    if (!contact.trim()) return Alert.alert('提示', '请输入联系方式')
    if (!intro.trim() || intro.trim().length < 10)
      return Alert.alert('提示', '简介至少 10 个字符')
    if (!agreed) return Alert.alert('提示', '请先同意开发者协议')
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      Alert.alert('提交成功', '申请已提交,审核结果将在 3 个工作日内通知', [
        { text: '知道了' },
      ])
    }, 800)
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>开发者入驻</Text>
        <Text style={s.headerSub}>填写资料,申请成为开发者</Text>
      </View>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.label}>开发者类型</Text>
        <View style={s.typeRow}>
          {(
            [
              { id: 'personal', label: '个人开发者' },
              { id: 'enterprise', label: '企业开发者' },
            ] as { id: DevType; label: string }[]
          ).map((t) => {
            const active = devType === t.id
            return (
              <TouchableOpacity
                key={t.id}
                style={[s.typeBtn, active && s.typeBtnActive]}
                onPress={() => setDevType(t.id)}
                activeOpacity={0.8}
              >
                <Text style={[s.typeText, active && s.typeTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={s.label}>{devType === 'personal' ? '姓名' : '企业名称'}</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder={devType === 'personal' ? '请输入真实姓名' : '请输入企业全称'}
          placeholderTextColor="#9CA3AF"
          maxLength={30}
        />

        <Text style={s.label}>联系方式</Text>
        <TextInput
          style={s.input}
          value={contact}
          onChangeText={setContact}
          placeholder="手机号或邮箱"
          placeholderTextColor="#9CA3AF"
          maxLength={50}
          keyboardType="email-address"
        />

        <Text style={s.label}>所属领域</Text>
        <View style={s.fieldRow}>
          {FIELD_OPTIONS.map((f) => {
            const active = field === f.id
            return (
              <TouchableOpacity
                key={f.id}
                style={[s.fieldBtn, active && s.fieldBtnActive]}
                onPress={() => setField(f.id)}
                activeOpacity={0.8}
              >
                <Text style={[s.fieldText, active && s.fieldTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={s.label}>开发者简介</Text>
        <TextInput
          style={[s.input, s.textarea]}
          value={intro}
          onChangeText={setIntro}
          placeholder="介绍你的能力、作品或服务方向(至少 10 个字符)"
          placeholderTextColor="#9CA3AF"
          maxLength={200}
          multiline
          textAlignVertical="top"
        />
        <Text style={s.counter}>{intro.length}/200</Text>

        <TouchableOpacity
          style={s.agreeRow}
          onPress={() => setAgreed((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={[s.checkbox, agreed && s.checkboxActive]} />
          <Text style={s.agreeText}>
            我已阅读并同意《开发者服务协议》《隐私政策》
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.btn, submitting && s.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <Text style={s.btnText}>{submitting ? '提交中...' : '提交申请'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  headerSub: { marginTop: 4, fontSize: 12, color: '#9CA3AF' },
  body: { padding: 16, paddingBottom: 32 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBtnActive: { borderColor: '#7B61FF', backgroundColor: '#FAF9FF' },
  typeText: { fontSize: 14, color: '#374151' },
  typeTextActive: { color: '#7B61FF', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  textarea: { minHeight: 90, paddingTop: 10 },
  counter: { marginTop: 6, textAlign: 'right', fontSize: 11, color: '#9CA3AF' },
  fieldRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fieldBtn: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldBtnActive: { borderColor: '#7B61FF', backgroundColor: '#FAF9FF' },
  fieldText: { fontSize: 13, color: '#374151' },
  fieldTextActive: { color: '#7B61FF', fontWeight: '600' },
  agreeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 8 },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: { backgroundColor: '#7B61FF', borderColor: '#7B61FF' },
  agreeText: { flex: 1, fontSize: 12, color: '#6B7280' },
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
})
