// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/help/HelpScreen.tsx(直载共享屏 + 注入本端事实)
//
// 端内保留:`getHelp` 取数、反馈三字段与 `submitFeedback` 端点契约、三处必填校验、
// 提交失败日志、AI 操控字段注册表(useUiField)。渲染(页头/搜索井/FAQ 手风琴/空态/
// 反馈表单/提交态)全部委托共享屏。

import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { getHelp, submitFeedback } from '@/api'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { onToast } from '@/host/on-toast'
import { useUiField } from '@/lib/ui-field-registry'
import { HelpScreen } from '@ihui/rn-app/features/help/HelpScreen'
import type { HelpListItem } from '@ihui/types'

interface FeedbackForm {
  username: string
  phone: string
  context: string
}

type FeedbackState = 'idle' | 'submitting' | 'success' | 'failed'

const DEFAULT_FORM: FeedbackForm = { username: '', phone: '', context: '' }

export default function HelpPage() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [list, setList] = useState<HelpListItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [opened, setOpened] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FeedbackForm>(DEFAULT_FORM)
  const [feedbackState, setFeedbackState] = useState<FeedbackState>('idle')

  const updateField = useCallback((field: keyof FeedbackForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  /** 三个输入事件回调与 useUiField 的 setValue 同源(都落到 updateField),满足采纳防漂移门 */
  const onInputName = useCallback((next: string) => updateField('username', next), [updateField])
  const onInputPhone = useCallback((next: string) => updateField('phone', next), [updateField])
  const onInputContext = useCallback((next: string) => updateField('context', next), [updateField])

  // AI 操控通道(2026-09-21):反馈表单三个输入框交给注册表,写入走 updateField(与 onInput 同一通道);
  // 提交按钮(对外发送)不注册。搜索框已由共享屏自身接入。
  useUiField({
    kind: 'input',
    label: tt('about.help.usernamePlaceholder', '请输入姓名'),
    placeholder: tt('about.help.usernamePlaceholder', '请输入姓名'),
    readValue: () => form.username,
    setValue: onInputName,
  })
  useUiField({
    kind: 'input',
    label: tt('about.help.phonePlaceholder', '请输入联系方式'),
    placeholder: tt('about.help.phonePlaceholder', '请输入联系方式'),
    readValue: () => form.phone,
    setValue: onInputPhone,
  })
  useUiField({
    kind: 'textarea',
    label: tt('feedback.contentPlaceholder', '请输入反馈详情'),
    placeholder: tt('feedback.contentPlaceholder', '请输入反馈详情'),
    readValue: () => form.context,
    setValue: onInputContext,
  })

  const load = useCallback(async () => {
    try {
      const res = await getHelp()
      setList((res.list || []).map((h) => ({ id: h.id, question: h.title, answer: h.content })))
    } finally {
      setLoading(false)
    }
  }, [])

  const toggle = useCallback((id: string) => {
    setOpened((prev) => (prev === id ? null : id))
  }, [])

  const validate = useCallback((): boolean => {
    if (!form.username.trim()) {
      onToast(tt('about.help.nameRequired', '请输入姓名'), { kind: 'info' })
      return false
    }
    if (!form.phone.trim()) {
      onToast(tt('about.help.phoneRequired', '请输入联系方式'), { kind: 'info' })
      return false
    }
    if (!form.context.trim()) {
      onToast(tt('about.help.contextRequired', '请输入反馈详情'), { kind: 'info' })
      return false
    }
    return true
  }, [form, tt])

  const submit = useCallback(async () => {
    if (!validate()) return
    setFeedbackState('submitting')
    try {
      await submitFeedback({ content: form.context, contact: form.phone, images: [] })
      setFeedbackState('success')
      setForm(DEFAULT_FORM)
    } catch (e) {
      logger.error('about/help', '提交反馈', e)
      setFeedbackState('failed')
    }
  }, [form, validate])

  useDidShow(() => load())

  return (
    <ThemeRoot>
      <HelpScreen
        t={t}
        items={list}
        loading={loading}
        refreshing={false}
        error=""
        expandedId={opened}
        onRefresh={() => {
          void load()
        }}
        onToggle={toggle}
        onBack={() => {
          void Taro.navigateBack()
        }}
        colorScheme={resolvedTheme}
        searchValue={keyword}
        onSearchChange={setKeyword}
        searchPlaceholder={tt('about.help.search', '搜索帮助')}
        feedbackName={form.username}
        feedbackContact={form.phone}
        feedbackContent={form.context}
        feedbackStatus={feedbackState}
        onFeedbackNameChange={onInputName}
        onFeedbackContactChange={onInputPhone}
        onFeedbackContentChange={onInputContext}
        onSubmitFeedback={() => {
          void submit()
        }}
        onToast={onToast}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
