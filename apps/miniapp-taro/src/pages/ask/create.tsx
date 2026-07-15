import { logger } from '@/utils/logger'
import { View, Text, Input, Textarea, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { createAsk } from '@/api'
import { useI18n } from '@/i18n'
import './create.css'

interface FormState {
  title: string
  content: string
  reward: number
}

const REWARDS = [0, 5, 10, 20, 50]

export default function AskCreatePage() {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ title: '', content: '', reward: 0 })

  const onSubmit = useCallback(async () => {
    try {
      await createAsk({ title: form.title, content: form.content })
      Taro.showToast({ title: t('ask.create.published'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch (e) {
      logger.error('ask/create', '发布问题', e)
      Taro.showToast({ title: t('ask.create.failed'), icon: 'none' })
    }
  }, [form.title, form.content, t])

  return (
    <View className="page">
      <View className="card">
        <Text className="label">{t('ask.create.titleLabel')}</Text>
        <Input
          className="input"
          value={form.title}
          placeholder={t('ask.create.titlePlaceholder')}
          maxlength={50}
          onInput={(e) => setForm((f) => ({ ...f, title: e.detail.value }))}
        />
        <Text className="label">{t('ask.create.detailLabel')}</Text>
        <Textarea
          className="textarea"
          value={form.content}
          placeholder={t('ask.create.detailPlaceholder')}
          maxlength={1000}
          onInput={(e) => setForm((f) => ({ ...f, content: e.detail.value }))}
        />
        <Text className="counter">{form.content.length}/1000</Text>
      </View>

      <View className="card">
        <Text className="label">{t('ask.create.rewardLabel')}</Text>
        <View className="rewards">
          {REWARDS.map((r) => (
            <Text
              key={r}
              className={`reward${form.reward === r ? ' active' : ''}`}
              onClick={() => setForm((f) => ({ ...f, reward: r }))}
            >
              {r}
            </Text>
          ))}
        </View>
      </View>

      <View className="tips">
        <Text>{t('ask.create.tip1')}</Text>
        <Text>{t('ask.create.tip2')}</Text>
        <Text>{t('ask.create.tip3')}</Text>
      </View>

      <Button className="btn" onClick={onSubmit} disabled={!form.title || form.content.length < 5}>
        {t('ask.create.submit')}
      </Button>
    </View>
  )
}
