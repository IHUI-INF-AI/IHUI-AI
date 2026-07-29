import { useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  ModelEditScreen as SharedModelEditScreen,
  type ModelEditBaseInfo,
  type ModelEditFieldValues,
  type ModelEditOption,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const MODEL_INFO: ModelEditBaseInfo = {
  name: '文案写作助手',
  prologue: '帮你快速生成营销文案、种草笔记、短视频脚本',
}

const CATEGORY_OPTIONS: ModelEditOption[] = [
  { id: '1', label: '文字' },
  { id: '2', label: '图片' },
  { id: '3', label: '视频' },
]

const DEPT_OPTIONS: ModelEditOption[] = [
  { id: 'd1', label: '营销推广' },
  { id: 'd2', label: '教育培训' },
  { id: 'd3', label: '生活服务' },
  { id: 'd4', label: '办公效率' },
]

const FREE_DURATIONS = ['一个月', '三个月', '六个月', '一年']

const DISCOUNTS: ModelEditOption[] = [
  { id: '1', label: '6 个月后 8 折' },
  { id: '2', label: '9 个月后 7 折' },
  { id: '3', label: '1 年后 5 折' },
]

export default function ModelEditScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [fields, setFields] = useState<ModelEditFieldValues>({
    categories: ['1'],
    dept: 'd1',
    saleType: 'limited',
    cycle: 'month',
    price: '',
    freeDur: '一年',
    audience: 'all',
    discount: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const handleChange = <K extends keyof ModelEditFieldValues>(key: K, value: ModelEditFieldValues[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  const toggleCategory = (id: string) => {
    setFields((prev) => ({
      ...prev,
      categories: prev.categories.includes(id)
        ? prev.categories.filter((c) => c !== id)
        : [...prev.categories, id],
    }))
  }

  const handleSubmit = () => {
    if (fields.categories.length === 0) {
      return Alert.alert(t('common.hint'), t('modelEdit.error.categoryRequired'))
    }
    if (fields.saleType !== 'free' && !fields.price) {
      return Alert.alert(t('common.hint'), t('modelEdit.error.priceRequired'))
    }
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      Alert.alert(t('modelEdit.success.title'), t('modelEdit.success.message'), [{ text: t('common.gotIt') }])
    }, 800)
  }

  return (
    <SharedModelEditScreen
      t={t}
      baseInfo={MODEL_INFO}
      fields={fields}
      categoryOptions={CATEGORY_OPTIONS}
      deptOptions={DEPT_OPTIONS}
      freeDurations={FREE_DURATIONS}
      discountOptions={DISCOUNTS}
      submitting={submitting}
      onChange={handleChange}
      onToggleCategory={toggleCategory}
      onSave={handleSubmit}
      onCancel={() => navigation.goBack()}
    />
  )
}
