// © 2026 IHUI AI (智汇AI) · 版权所有者: 李
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import {} from 'react-native'
import { appAlert } from '../components/BottomPops'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { createPlaza } from '@ihui/api-client'
import { toUserFriendlyMessage } from '@ihui/shared/utils'
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
  cycleUnit: t('need.cycleUnitWeek'),
  types: '',
  categories: '',
  closingTime: '',
  imgs: '',
}

const DESC_MIN = 10

function showAlert(message: string): void {
  appAlert(t('home.pubTip'), message, [{ text: t('common.known') }])
}

export function SetNeedScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)

  const updateField = (key: keyof FormState, value: string): void => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const validate = (): string => {
    if (!form.title.trim()) return t('need.titleRequired')
    if (form.title.trim().length < 2) return t('need.titleMin2')
    if (!form.description.trim()) return t('need.descRequired')
    if (form.description.trim().length < DESC_MIN) return t('need.descMin', { n: DESC_MIN })
    const low = Number(form.lowestPrice)
    const peak = Number(form.peakPrice)
    if (!form.lowestPrice || Number.isNaN(low) || low <= 0) return t('need.priceLowRequired')
    if (!form.peakPrice || Number.isNaN(peak) || peak <= 0) return t('need.priceHighRequired')
    if (low > peak) return t('need.priceOrder')
    if (low < 100) return t('need.priceMin100')
    if (!form.contact.trim()) return t('need.contactRequired')
    if (!form.closingTime.trim()) return t('need.timeRequired')
    const closingTime = new Date(form.closingTime)
    if (Number.isNaN(closingTime.getTime())) return t('need.timeInvalid')
    if (closingTime.getTime() <= Date.now()) return t('need.timePast')
    if (!form.cycle.trim() || Number(form.cycle) <= 0) return t('need.cycleRequired')
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
        appAlert(t('need.publishedTitle'), t('need.publishedBody'), [
          { text: t('need.okBtn'), onPress: () => navigation.goBack() },
        ])
      } else {
        showAlert(res.error || t('need.submitFail'))
      }
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
      showAlert(detail.trim() ? toUserFriendlyMessage(e) : t('need.netFail'))
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
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
