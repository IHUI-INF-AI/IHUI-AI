import { logger } from '@/utils/logger'
import { View, Text, Input, Textarea, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import { getHelp, submitFeedback } from '@/api'
import { useI18n } from '@/i18n'
import './help.css'

interface HelpItem {
  id: string
  title: string
  content: string
}

interface FeedbackForm {
  username: string
  phone: string
  context: string
}

type FeedbackState = 'idle' | 'submitting' | 'success' | 'failed'

const DEFAULT_FORM: FeedbackForm = { username: '', phone: '', context: '' }

export default function HelpPage() {
  const { t } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [list, setList] = useState<HelpItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [opened, setOpened] = useState('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FeedbackForm>(DEFAULT_FORM)
  const [feedbackState, setFeedbackState] = useState<FeedbackState>('idle')

  const filtered = useMemo(() => {
    if (!keyword) return list
    return list.filter((h) => h.title.includes(keyword) || h.content.includes(keyword))
  }, [list, keyword])

  const load = useCallback(async () => {
    try {
      const res = await getHelp()
      setList(res.list || [])
    } finally {
      setLoading(false)
    }
  }, [])

  const toggle = useCallback((id: string) => {
    setOpened((prev) => (prev === id ? '' : id))
  }, [])

  const updateField = useCallback((field: keyof FeedbackForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const validate = useCallback((): boolean => {
    if (!form.username.trim()) {
      Taro.showToast({ title: tt('about.help.nameRequired', '请输入姓名'), icon: 'none' })
      return false
    }
    if (!form.phone.trim()) {
      Taro.showToast({ title: tt('about.help.phoneRequired', '请输入联系方式'), icon: 'none' })
      return false
    }
    if (!form.context.trim()) {
      Taro.showToast({ title: tt('about.help.contextRequired', '请输入反馈详情'), icon: 'none' })
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
    <View className="page">
      <View className="search-bar">
        <Input
          className="search-input"
          placeholder={tt('about.help.search', '搜索帮助')}
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
        />
      </View>

      <View className="section-title">
        {tt('about.help.faqTitle', '常见问题')}
      </View>

      {filtered.length ? (
        <View className="list">
          {filtered.map((h) => (
            <View key={h.id} className="item" onClick={() => toggle(h.id)}>
              <View className="item-head">
                <Text className="title">{h.title}</Text>
                <Text className={`arrow${opened === h.id ? ' open' : ''}`}>›</Text>
              </View>
              {opened === h.id ? (
                <View className="content">
                  <Text>{h.content}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {!loading && !filtered.length ? (
        <View className="empty">
          <Text>{tt('about.help.empty', '暂无帮助内容')}</Text>
        </View>
      ) : null}

      <View className="section-title">
        {tt('about.help.feedbackTitle', '意见反馈')}
      </View>

      <View className="form">
        <View className="form-group">
          <Text className="form-label">
            <Text className="required">*</Text>
            {tt('about.help.username', '姓名')}
          </Text>
          <Input
            className="form-input"
            value={form.username}
            placeholder={tt('about.help.usernamePlaceholder', '请输入姓名')}
            onInput={(e) => updateField('username', e.detail.value)}
          />
        </View>
        <View className="form-group">
          <Text className="form-label">
            <Text className="required">*</Text>
            {tt('about.help.phone', '联系方式')}
          </Text>
          <Input
            className="form-input"
            value={form.phone}
            placeholder={tt('about.help.phonePlaceholder', '请输入联系方式')}
            onInput={(e) => updateField('phone', e.detail.value)}
          />
        </View>
        <View className="form-group">
          <Text className="form-label">
            <Text className="required">*</Text>
            {tt('about.help.context', '问题描述')}
          </Text>
          <Textarea
            className="form-textarea"
            value={form.context}
            placeholder={tt('about.help.contextPlaceholder', '请输入反馈详情')}
            onInput={(e) => updateField('context', e.detail.value)}
          />
        </View>
        <Text className="form-tip">
          {tt(
            'about.help.submitTip',
            '您的反馈将用于改进我们的产品与服务,发送后请耐心等待处理',
          )}
        </Text>
        <Button
          className="submit-btn"
          disabled={feedbackState === 'submitting'}
          onClick={submit}
        >
          {feedbackState === 'submitting'
            ? tt('about.help.submitting', '提交中...')
            : tt('about.help.submit', '提交反馈')}
        </Button>
        {feedbackState === 'success' ? (
          <Text className="feedback-status status-success">
            {tt('about.help.submitSuccess', '反馈提交成功')}
          </Text>
        ) : null}
        {feedbackState === 'failed' ? (
          <Text className="feedback-status status-failed">
            {tt('about.help.submitFailed', '反馈提交失败,请稍后重试')}
          </Text>
        ) : null}
      </View>
    </View>
  )
}
