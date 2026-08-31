// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { createPlaza } from '@ihui/api-client'
import { SetNeedScreen as SharedSetNeedScreen } from '@ihui/rn-app'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface FormState {
  title: string
  description: string
  lowestPrice: string
  peakPrice: string
  contact: string
  cycle: string
  cycleUnit: string
  types: string
  categories: string
  closingTime: string
  imgs: string
}

const INITIAL_FORM: FormState = {
  title: '',
  description: '',
  lowestPrice: '',
  peakPrice: '',
  contact: '',
  cycle: '1',
  cycleUnit: '周',
  types: '',
  categories: '',
  closingTime: '',
  imgs: '',
}

const DESC_MIN = 10

function showAlert(message: string): void {
  Alert.alert('提示', message, [{ text: '知道了' }])
}

export function SetNeedScreen() {
  const { t } = useI18n()
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
    if (!form.closingTime.trim()) return '请设置任务截止时间'
    const closingTime = new Date(form.closingTime)
    if (Number.isNaN(closingTime.getTime())) return '截止时间格式无效'
    if (closingTime.getTime() <= Date.now()) return '截止时间必须晚于当前时间'
    if (!form.cycle.trim() || Number(form.cycle) <= 0) return '请设置有效的开发周期'
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
        lowestPrice: Number(form.lowestPrice),
        peakPrice: Number(form.peakPrice),
        contact: form.contact.trim(),
        cycle: form.cycle.trim() || undefined,
        cycleUnit: form.cycleUnit.trim() || undefined,
        closingTime: new Date(form.closingTime.trim()).toISOString(),
        imgs: form.imgs
          .split(',')
          .map((url) => url.trim())
          .filter(Boolean),
        types: form.types.trim() ? [form.types.trim()] : undefined,
        categories: form.categories.trim() ? [form.categories.trim()] : undefined,
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
    <SharedSetNeedScreen
      t={t}
      form={form}
      submitting={submitting}
      onFieldChange={updateField as (field: string, value: string) => void}
      onSubmit={onSubmit}
      onBack={() => navigation.goBack()}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
