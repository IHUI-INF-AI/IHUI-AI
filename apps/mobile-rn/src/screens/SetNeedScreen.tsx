/**
 * SetNeedScreen 设置需求 / 发布需求表单(mobile-rn 端)
 *
 * 对齐历史 Uniapp pagesA/plaza/set_need.vue(发布需求表单页):
 * - 顶部 NavBar「设置需求」+ 返回
 * - 表单:需求标题 + 需求描述 + 预算(起步价/最高价)+ 联系方式
 * - 提交按钮 → 调用 createPlaza API(若失败 Alert 提示)
 * - 浅色优雅风,rnLightTokens;圆角守门(无 rounded-full);无分割线
 */
import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { createPlaza } from '@ihui/api-client'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import Loading from '../components/common/Loading'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface FormState {
  title: string
  description: string
  lowestPrice: string
  peakPrice: string
  contact: string
}

const INITIAL_FORM: FormState = {
  title: '',
  description: '',
  lowestPrice: '',
  peakPrice: '',
  contact: '',
}

const TITLE_MAX = 50
const DESC_MIN = 10

function showAlert(message: string): void {
  Alert.alert('提示', message, [{ text: '知道了' }])
}

export function SetNeedScreen() {
  const navigation = useNavigation<NavigationProp>()
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)

  const updateField = (key: keyof FormState, value: string): void => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const validate = (): string => {
    if (!form.title.trim()) return '请输入需求标题'
    if (form.title.trim().length < 2) return '需求标题至少 2 个字符'
    if (!form.description.trim()) return '请输入需求描述'
    if (form.description.trim().length < DESC_MIN) return `需求描述至少 ${DESC_MIN} 个字符`
    const low = Number(form.lowestPrice)
    const peak = Number(form.peakPrice)
    if (!form.lowestPrice || Number.isNaN(low) || low <= 0) return '请输入有效的起步价'
    if (!form.peakPrice || Number.isNaN(peak) || peak <= 0) return '请输入有效的最高价'
    if (low > peak) return '起步价不能高于最高价'
    if (low < 100) return '起步价不能低于 100 元'
    if (!form.contact.trim()) return '请输入联系方式'
    return ''
  }

  const onSubmit = async (): Promise<void> => {
    const err = validate()
    if (err) {
      showAlert(err)
      return
    }
    setSubmitting(true)
    try {
      const res = await createPlaza({
        title: form.title.trim(),
        description: form.description.trim(),
      })
      if (res.success) {
        Alert.alert('提交成功', '需求已发布,稍后将在广场展示', [
          { text: '好的', onPress: () => navigation.goBack() },
        ])
      } else {
        showAlert(res.error || '提交失败,请稍后重试')
      }
    } catch {
      showAlert('网络异常,请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>
      <NavBar title="设置需求" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FieldLabel label="需求标题" required />
          <TextInput
            style={styles.input}
            value={form.title}
            onChangeText={(v) => updateField('title', v)}
            placeholder="一句话描述你的需求"
            placeholderTextColor={tk.text.tertiary}
            maxLength={TITLE_MAX}
          />

          <FieldLabel label="需求描述" required />
          <TextInput
            style={[styles.input, styles.textarea]}
            value={form.description}
            onChangeText={(v) => updateField('description', v)}
            placeholder="详细说明需求背景、功能点、交付要求等(至少 10 字)"
            placeholderTextColor={tk.text.tertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <FieldLabel label="预算区间(元)" required />
          <View style={styles.priceRow}>
            <TextInput
              style={[styles.input, styles.priceInput]}
              value={form.lowestPrice}
              onChangeText={(v) => updateField('lowestPrice', v)}
              placeholder="起步价"
              placeholderTextColor={tk.text.tertiary}
              keyboardType="numeric"
            />
            <Text style={styles.priceDash}>~</Text>
            <TextInput
              style={[styles.input, styles.priceInput]}
              value={form.peakPrice}
              onChangeText={(v) => updateField('peakPrice', v)}
              placeholder="最高价"
              placeholderTextColor={tk.text.tertiary}
              keyboardType="numeric"
            />
          </View>

          <FieldLabel label="联系方式" required />
          <TextInput
            style={styles.input}
            value={form.contact}
            onChangeText={(v) => updateField('contact', v)}
            placeholder="手机号 / 微信号 / 邮箱"
            placeholderTextColor={tk.text.tertiary}
            autoCapitalize="none"
          />

          <Pressable
            style={({ pressed }) => [styles.submitBtn, pressed ? styles.submitBtnPressed : null]}
            onPress={() => void onSubmit()}
            accessibilityRole="button"
            accessibilityLabel="提交需求"
          >
            {submitting ? (
              <Loading text="" />
            ) : (
              <Text style={styles.submitBtnText}>提交需求</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

interface FieldLabelProps {
  label: string
  required?: boolean
}

function FieldLabel({ label, required }: FieldLabelProps): React.JSX.Element {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {required ? <Text style={styles.requiredMark}>*</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
  flex: { flex: 1 } as ViewStyle,
  scrollContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 } as ViewStyle,
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 8 } as ViewStyle,
  fieldLabel: { fontSize: 14, fontWeight: '600', color: tk.text.primary } as TextStyle,
  requiredMark: { fontSize: 14, color: tk.danger.DEFAULT } as TextStyle,
  input: {
    backgroundColor: tk.surface.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: tk.text.primary,
  } as TextStyle,
  textarea: { minHeight: 96, paddingTop: 12 } as TextStyle,
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 } as ViewStyle,
  priceInput: { flex: 1 } as TextStyle,
  priceDash: { fontSize: 16, color: tk.text.tertiary } as TextStyle,
  submitBtn: {
    backgroundColor: tk.brand.DEFAULT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  } as ViewStyle,
  submitBtnPressed: { opacity: 0.85 } as ViewStyle,
  submitBtnText: { fontSize: 16, fontWeight: '600', color: tk.surface.light } as TextStyle,
})

export default SetNeedScreen
