import { logger } from '@/utils/logger'
import { View, Text, Input, Textarea, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import { getHelp, submitFeedback } from '@/api'
import { useI18n } from '@/i18n'

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
    <View className="min-h-screen bg-background pb-[60rpx]">
      <View className="py-[24rpx] px-[32rpx]">
        <Input
          className="h-[72rpx] px-[24rpx] bg-card rounded-[36rpx] text-[26rpx] text-foreground"
          placeholder={tt('about.help.search', '搜索帮助')}
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
        />
      </View>

      <View className="block pt-[16rpx] px-[32rpx] pb-[8rpx] text-[28rpx] font-semibold text-foreground">
        {tt('about.help.faqTitle', '常见问题')}
      </View>

      {filtered.length ? (
        <View className="px-[24rpx]">
          {filtered.map((h) => (
            <View key={h.id} className="bg-card rounded-[16rpx] mb-[16rpx] overflow-hidden" onClick={() => toggle(h.id)}>
              <View className="flex justify-between items-center p-[32rpx]">
                <Text className="text-[28rpx] text-foreground flex-1">{h.title}</Text>
                <Text className={`text-muted-foreground text-[32rpx] ${opened === h.id ? '-rotate-90' : 'rotate-90'}`}>›</Text>
              </View>
              {opened === h.id ? (
                <View className="px-[32rpx] pb-[32rpx] text-[26rpx] text-muted-foreground leading-[1.6]">
                  <Text>{h.content}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {!loading && !filtered.length ? (
        <View className="text-center py-[120rpx] text-muted-foreground text-[26rpx]">
          <Text>{tt('about.help.empty', '暂无帮助内容')}</Text>
        </View>
      ) : null}

      <View className="block pt-[16rpx] px-[32rpx] pb-[8rpx] text-[28rpx] font-semibold text-foreground">
        {tt('about.help.feedbackTitle', '意见反馈')}
      </View>

      <View className="mx-[24rpx] p-[32rpx] bg-card rounded-[16rpx]">
        <View className="mb-[24rpx]">
          <Text className="block text-[28rpx] text-foreground mb-[12rpx] font-medium">
            <Text className="text-[#ef4444] mr-[4rpx]">*</Text>
            {tt('about.help.username', '姓名')}
          </Text>
          <Input
            className="w-full h-[80rpx] px-[20rpx] box-border bg-background border-[2rpx] border-border rounded-[8rpx] text-[26rpx] text-foreground"
            value={form.username}
            placeholder={tt('about.help.usernamePlaceholder', '请输入姓名')}
            onInput={(e) => updateField('username', e.detail.value)}
          />
        </View>
        <View className="mb-[24rpx]">
          <Text className="block text-[28rpx] text-foreground mb-[12rpx] font-medium">
            <Text className="text-[#ef4444] mr-[4rpx]">*</Text>
            {tt('about.help.phone', '联系方式')}
          </Text>
          <Input
            className="w-full h-[80rpx] px-[20rpx] box-border bg-background border-[2rpx] border-border rounded-[8rpx] text-[26rpx] text-foreground"
            value={form.phone}
            placeholder={tt('about.help.phonePlaceholder', '请输入联系方式')}
            onInput={(e) => updateField('phone', e.detail.value)}
          />
        </View>
        <View className="mb-[24rpx]">
          <Text className="block text-[28rpx] text-foreground mb-[12rpx] font-medium">
            <Text className="text-[#ef4444] mr-[4rpx]">*</Text>
            {tt('about.help.context', '问题描述')}
          </Text>
          <Textarea
            className="w-full min-h-[180rpx] px-[20rpx] py-[16rpx] box-border bg-background border-[2rpx] border-border rounded-[8rpx] text-[26rpx] text-foreground"
            value={form.context}
            placeholder={tt('about.help.contextPlaceholder', '请输入反馈详情')}
            onInput={(e) => updateField('context', e.detail.value)}
          />
        </View>
        <Text className="block text-[22rpx] text-muted-foreground leading-[1.6] mb-[24rpx]">
          {tt(
            'about.help.submitTip',
            '您的反馈将用于改进我们的产品与服务,发送后请耐心等待处理',
          )}
        </Text>
        <Button
          className="w-full h-[80rpx] leading-[80rpx] bg-primary text-white text-[28rpx] rounded-[8rpx] m-0 disabled:opacity-60"
          disabled={feedbackState === 'submitting'}
          onClick={submit}
        >
          {feedbackState === 'submitting'
            ? tt('about.help.submitting', '提交中...')
            : tt('about.help.submit', '提交反馈')}
        </Button>
        {feedbackState === 'success' ? (
          <Text className="block text-center text-[24rpx] mt-[16rpx] text-[#10b981]">
            {tt('about.help.submitSuccess', '反馈提交成功')}
          </Text>
        ) : null}
        {feedbackState === 'failed' ? (
          <Text className="block text-center text-[24rpx] mt-[16rpx] text-[#ef4444]">
            {tt('about.help.submitFailed', '反馈提交失败,请稍后重试')}
          </Text>
        ) : null}
      </View>
    </View>
  )
}
