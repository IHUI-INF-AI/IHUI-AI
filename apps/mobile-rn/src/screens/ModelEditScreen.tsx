// © 2026 IHUI AI (智汇AI) · 版权所有者: 李
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import {} from 'react-native'
import { appAlert } from '../components/BottomPops'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import {
  ModelEditScreen as SharedModelEditScreen,
  submitModelEdit,
  type ModelEditBaseInfo,
  type ModelEditFieldValues,
  type ModelEditOption,
} from '@ihui/rn-app'
import { updateAgentBilling } from '@ihui/api-client'
import { toUserFriendlyMessage } from '@ihui/shared/utils'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useHostPorts } from '../host/use-host-ports'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type ModelEditRoute = RouteProp<RootStackParamList, 'ModelEdit'>

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
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<ModelEditRoute>()
  const { onToast } = useHostPorts()
  const agentId = route.params?.agentId
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

  const handleChange = <K extends keyof ModelEditFieldValues>(
    key: K,
    value: ModelEditFieldValues[K],
  ) => {
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

  const handleSubmit = async () => {
    if (submitting) return
    if (fields.categories.length === 0) {
      return appAlert(t('common.hint'), t('modelEdit.error.categoryRequired'))
    }
    if (fields.saleType !== 'free' && !fields.price) {
      return appAlert(t('common.hint'), t('modelEdit.error.priceRequired'))
    }
    // 没有真实模型 ID 时不发假请求、不弹假成功(数据源为 DevEnter「待发布」项的 agentId)。
    if (!agentId) {
      return onToast(t('common.failed'), { kind: 'error' })
    }
    setSubmitting(true)
    const outcome = await submitModelEdit(updateAgentBilling, agentId, fields)
    setSubmitting(false)
    if (!outcome.ok) {
      // 失败走宿主 onToast 真实上屏:网络异常/服务端 success:false 都原样带出,不吞错。
      return onToast(toUserFriendlyMessage(outcome.error), { kind: 'error' })
    }
    appAlert(t('modelEdit.success.title'), t('modelEdit.success.message'), [
      { text: t('common.gotIt') },
    ])
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
      colorScheme={resolvedTheme}
      onToast={onToast}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
