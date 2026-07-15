import { View, Text, Input, Textarea, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { publishAigc } from '@/api'
import { useI18n } from '@/i18n'
import './publish.css'

export default function AigcPublish() {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = useCallback(async () => {
    if (!title.trim()) {
      Taro.showToast({ title: t('aigc.publish.titleRequired'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await publishAigc({ title, content })
      Taro.showToast({ title: t('aigc.publish.published'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }, [title, content, t])

  return (
    <View className="publish-page">
      <View className="page-header">
        <Text className="page-title">{t('aigc.publish.title')}</Text>
      </View>
      <View className="form">
        <View className="form-item">
          <Text className="form-label">{t('aigc.publish.titleLabel')}</Text>
          <Input
            className="form-input"
            placeholder={t('aigc.publish.titlePlaceholder')}
            value={title}
            onInput={(e) => setTitle(e.detail.value)}
          />
        </View>
        <View className="form-item">
          <Text className="form-label">{t('aigc.publish.descLabel')}</Text>
          <Textarea
            className="form-textarea"
            placeholder={t('aigc.publish.descPlaceholder')}
            value={content}
            onInput={(e) => setContent(e.detail.value)}
          />
        </View>
        <Button
          className="submit-btn"
          loading={submitting}
          disabled={submitting}
          onClick={onSubmit}
        >
          {t('aigc.publish.publish')}
        </Button>
      </View>
    </View>
  )
}
