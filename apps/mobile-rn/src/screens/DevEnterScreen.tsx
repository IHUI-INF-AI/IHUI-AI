import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { Input } from '@ihui/ui-native'

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
    <View className="flex-1 bg-card">
      <View className="px-4 pt-3 pb-2">
        <Text className="text-lg font-semibold text-foreground">开发者入驻</Text>
        <Text className="mt-1 text-xs text-[#9CA3AF]">填写资料,申请成为开发者</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Text className="text-[13px] font-semibold text-[#374151] mt-4 mb-2">开发者类型</Text>
        <View className="flex-row gap-3">
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
                className={`flex-1 h-11 rounded-lg border items-center justify-center ${active ? 'border-[#7B61FF] bg-[#FAF9FF]' : 'border-border'}`}
                onPress={() => setDevType(t.id)}
                activeOpacity={0.8}
              >
                <Text className={`text-sm ${active ? 'text-[#7B61FF] font-semibold' : 'text-[#374151]'}`}>{t.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text className="text-[13px] font-semibold text-[#374151] mt-4 mb-2">{devType === 'personal' ? '姓名' : '企业名称'}</Text>
        <Input
          className="rounded-lg bg-card py-2.5"
          value={name}
          onChangeText={setName}
          placeholder={devType === 'personal' ? '请输入真实姓名' : '请输入企业全称'}
          maxLength={30}
        />

        <Text className="text-[13px] font-semibold text-[#374151] mt-4 mb-2">联系方式</Text>
        <Input
          className="rounded-lg bg-card py-2.5"
          value={contact}
          onChangeText={setContact}
          placeholder="手机号或邮箱"
          maxLength={50}
          keyboardType="email-address"
        />

        <Text className="text-[13px] font-semibold text-[#374151] mt-4 mb-2">所属领域</Text>
        <View className="flex-row flex-wrap gap-2.5">
          {FIELD_OPTIONS.map((f) => {
            const active = field === f.id
            return (
              <TouchableOpacity
                key={f.id}
                className={`px-3.5 h-9 rounded-lg border items-center justify-center ${active ? 'border-[#7B61FF] bg-[#FAF9FF]' : 'border-border'}`}
                onPress={() => setField(f.id)}
                activeOpacity={0.8}
              >
                <Text className={`text-[13px] ${active ? 'text-[#7B61FF] font-semibold' : 'text-[#374151]'}`}>{f.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text className="text-[13px] font-semibold text-[#374151] mt-4 mb-2">开发者简介</Text>
        <Input
          className="rounded-lg bg-card min-h-[90px] py-2.5"
          value={intro}
          onChangeText={setIntro}
          placeholder="介绍你的能力、作品或服务方向(至少 10 个字符)"
          maxLength={200}
          multiline
          textAlignVertical="top"
        />
        <Text className="mt-1.5 text-right text-[11px] text-[#9CA3AF]">{intro.length}/200</Text>

        <TouchableOpacity
          className="flex-row items-center mt-5 gap-2"
          onPress={() => setAgreed((v) => !v)}
          activeOpacity={0.8}
        >
          <View className={`w-4 h-4 rounded border ${agreed ? 'bg-[#7B61FF] border-[#7B61FF]' : 'border-[#D1D5DB] bg-card'}`} />
          <Text className="flex-1 text-xs text-muted-foreground">
            我已阅读并同意《开发者服务协议》《隐私政策》
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`mt-6 h-[46px] rounded-xl bg-[#7B61FF] items-center justify-center ${submitting ? 'opacity-60' : ''}`}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <Text className="text-[15px] font-semibold text-white">{submitting ? '提交中...' : '提交申请'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}
