// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Input, Textarea, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import { getHelp, submitFeedback } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

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
    <ThemeRoot>
      <View className="min-h-screen bg-background px-[28rpx] pt-[28rpx] pb-[64rpx]">
        <View className="mb-[24rpx]">
          <Input
            className="h-[80rpx] px-[24rpx] bg-muted border-[2rpx] border-border rounded-[24rpx] text-[28rpx] text-foreground"
            placeholder={tt('about.help.search', '搜索帮助')}
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
          />
        </View>

        <Text className="block text-[28rpx] font-semibold text-foreground pt-[16rpx] pb-[16rpx]">
          {tt('about.help.faqTitle', '常见问题')}
        </Text>

        {filtered.length ? (
          <View>
            {filtered.map((h) => (
              <View
                key={h.id}
                className="bg-card rounded-[24rpx] border border-border p-[28rpx] mb-[24rpx] overflow-hidden"
                onClick={() => toggle(h.id)}
                hoverClass="opacity-60">
                <View className="flex justify-between items-center">
                  <Text className="text-[32rpx] font-bold text-foreground flex-1">{h.title}</Text>
                  <Text className="text-success text-[40rpx] ml-[16rpx]">
                    {opened === h.id ? '−' : '+'}
                  </Text>
                </View>
                {opened === h.id ? (
                  <Text className="block mt-[16rpx] text-[28rpx] text-[var(--color-text-medium)] leading-[36rpx]">
                    {h.content}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {!loading && !filtered.length ? (
          <View className="text-center py-[96rpx]">
            <Text className="text-[28rpx] text-muted-foreground">
              {tt('about.help.empty', '暂无帮助内容')}
            </Text>
          </View>
        ) : null}

        <Text className="block text-[28rpx] font-semibold text-foreground pt-[16rpx] pb-[16rpx]">
          {tt('about.help.feedbackTitle', '意见反馈')}
        </Text>

        <View className="p-[28rpx] bg-card rounded-[24rpx] border border-border">
          <View className="mb-[24rpx]">
            <Text className="block text-[28rpx] text-foreground mb-[12rpx] font-medium">
              <Text className="text-destructive mr-[4rpx]">*</Text>
              {tt('about.help.username', '姓名')}
            </Text>
            <Input
              className="w-full h-[100rpx] px-[24rpx] box-border bg-muted border-[2rpx] border-border rounded-[24rpx] text-[28rpx] text-foreground"
              value={form.username}
              placeholder={tt('about.help.usernamePlaceholder', '请输入姓名')}
              onInput={(e) => updateField('username', e.detail.value)}
            />
          </View>
          <View className="mb-[24rpx]">
            <Text className="block text-[28rpx] text-foreground mb-[12rpx] font-medium">
              <Text className="text-destructive mr-[4rpx]">*</Text>
              {tt('about.help.phone', '联系方式')}
            </Text>
            <Input
              className="w-full h-[100rpx] px-[24rpx] box-border bg-muted border-[2rpx] border-border rounded-[24rpx] text-[28rpx] text-foreground"
              value={form.phone}
              placeholder={tt('about.help.phonePlaceholder', '请输入联系方式')}
              onInput={(e) => updateField('phone', e.detail.value)}
            />
          </View>
          <View className="mb-[24rpx]">
            <Text className="block text-[28rpx] text-foreground mb-[12rpx] font-medium">
              <Text className="text-destructive mr-[4rpx]">*</Text>
              {tt('about.help.context', '问题描述')}
            </Text>
            <Textarea
              className="w-full min-h-[180rpx] px-[24rpx] py-[16rpx] box-border bg-muted border-[2rpx] border-border rounded-[24rpx] text-[28rpx] text-foreground"
              value={form.context}
              placeholder={tt('about.help.contextPlaceholder', '请输入反馈详情')}
              onInput={(e) => updateField('context', e.detail.value)}
            />
          </View>
          <Text className="block text-[22rpx] text-[var(--color-text-tertiary)] leading-[1.6] mb-[24rpx]">
            {tt('about.help.submitTip', '您的反馈将用于改进我们的产品与服务,发送后请耐心等待处理')}
          </Text>
          <Button
            className="w-full h-[100rpx] leading-[100rpx] bg-primary text-[var(--color-primary-foreground)] text-[32rpx] font-semibold rounded-[24rpx] m-0 after:border-0 disabled:opacity-60"
            disabled={feedbackState === 'submitting'}
            onClick={submit}
          >
            {feedbackState === 'submitting'
              ? tt('about.help.submitting', '提交中...')
              : tt('about.help.submit', '提交反馈')}
          </Button>
          {feedbackState === 'success' ? (
            <Text className="block text-center text-[28rpx] mt-[16rpx] text-success">
              {tt('about.help.submitSuccess', '反馈提交成功')}
            </Text>
          ) : null}
          {feedbackState === 'failed' ? (
            <Text className="block text-center text-[28rpx] mt-[16rpx] text-destructive">
              {tt('about.help.submitFailed', '反馈提交失败,请稍后重试')}
            </Text>
          ) : null}
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
