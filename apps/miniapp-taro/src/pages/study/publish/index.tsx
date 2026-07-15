import { View, Text, Input, Textarea, Button, Picker } from '@tarojs/components'
import { logger } from '@/utils/logger'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { post } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function StudyPublish() {
  const { t, tList } = useI18n()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState(0)
  const [visibility, setVisibility] = useState(0)
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)

  const categories = tList('study.publish.categories')
  const visibilityOptions = tList('study.publish.visibilityOptions')

  const submit = useCallback(async () => {
    if (!title.trim()) {
      Taro.showToast({ title: t('study.publish.enterTitle'), icon: 'none' })
      return
    }
    if (!content.trim()) {
      Taro.showToast({ title: t('study.publish.enterContent'), icon: 'none' })
      return
    }
    setSaving(true)
    try {
      await post('/study/publish', {
        title: title.trim(),
        content: content.trim(),
        category: categories[category],
        visibility: visibilityOptions[visibility],
        tags: tags.trim(),
      })
      Taro.showToast({ title: t('study.publish.published'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch (e) {
      logger.error('study/publish', 'submit', e)
    } finally {
      setSaving(false)
    }
  }, [title, content, category, visibility, tags, categories, visibilityOptions, t])

  return (
    <View className="page">
      <View className="card">
        <Input
          className="title-input"
          placeholder={t('study.publish.titlePlaceholder')}
          maxlength={50}
          value={title}
          onInput={(e) => setTitle(e.detail.value)}
        />
      </View>

      <View className="card">
        <Textarea
          className="content-input"
          placeholder={t('study.publish.contentPlaceholder')}
          maxlength={2000}
          value={content}
          onInput={(e) => setContent(e.detail.value)}
        />
        <View className="word-count">
          <Text>{content.length}/2000</Text>
        </View>
      </View>

      <View className="card">
        <Picker
          mode="selector"
          range={categories}
          value={category}
          onChange={(e) => setCategory(Number(e.detail.value))}
        >
          <View className="picker-row">
            <Text className="picker-label">{t('study.publish.category')}</Text>
            <Text className="picker-value">{categories[category]}</Text>
            <Text className="arrow">›</Text>
          </View>
        </Picker>
        <View className="divider" />
        <Picker
          mode="selector"
          range={visibilityOptions}
          value={visibility}
          onChange={(e) => setVisibility(Number(e.detail.value))}
        >
          <View className="picker-row">
            <Text className="picker-label">{t('study.publish.visibility')}</Text>
            <Text className="picker-value">{visibilityOptions[visibility]}</Text>
            <Text className="arrow">›</Text>
          </View>
        </Picker>
        <View className="divider" />
        <Input
          className="tags-input"
          placeholder={t('study.publish.tagsPlaceholder')}
          value={tags}
          onInput={(e) => setTags(e.detail.value)}
        />
      </View>

      <Button className="submit-btn" loading={saving} onClick={submit} disabled={saving}>
        {t('study.publish.submit')}
      </Button>
    </View>
  )
}
