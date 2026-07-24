import { View, Text, Input, Textarea, Button, Picker } from '@tarojs/components'
import { logger } from '@/utils/logger'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { post } from '@/api'
import { useI18n } from '@/i18n'

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
    <View className="min-h-screen bg-background pb-[140rpx]">
      <View className="m-[24rpx] p-[32rpx] bg-card rounded-[16rpx]">
        <Input
          className="text-[32rpx] text-foreground"
          placeholder={t('study.publish.titlePlaceholder')}
          maxlength={50}
          value={title}
          onInput={(e) => setTitle(e.detail.value)}
        />
      </View>

      <View className="m-[24rpx] p-[32rpx] bg-card rounded-[16rpx]">
        <Textarea
          className="w-full min-h-[300rpx] text-[28rpx] text-foreground leading-[1.7]"
          placeholder={t('study.publish.contentPlaceholder')}
          maxlength={2000}
          value={content}
          onInput={(e) => setContent(e.detail.value)}
        />
        <View className="text-right mt-[12rpx]">
          <Text className="text-[22rpx] text-muted-foreground">{content.length}/2000</Text>
        </View>
      </View>

      <View className="m-[24rpx] p-[32rpx] bg-card rounded-[16rpx]">
        <Picker
          mode="selector"
          range={categories}
          value={category}
          onChange={(e) => setCategory(Number(e.detail.value))}
        >
          <View className="flex items-center h-[80rpx]">
            <Text className="text-[28rpx] text-foreground w-[160rpx]">{t('study.publish.category')}</Text>
            <Text className="flex-1 text-[28rpx] text-muted-foreground text-right">{categories[category]}</Text>
            <Text className="text-[32rpx] text-muted-foreground ml-[16rpx]">›</Text>
          </View>
        </Picker>
        <View className="h-[2rpx] bg-background mx-[-32rpx]" />
        <Picker
          mode="selector"
          range={visibilityOptions}
          value={visibility}
          onChange={(e) => setVisibility(Number(e.detail.value))}
        >
          <View className="flex items-center h-[80rpx]">
            <Text className="text-[28rpx] text-foreground w-[160rpx]">{t('study.publish.visibility')}</Text>
            <Text className="flex-1 text-[28rpx] text-muted-foreground text-right">{visibilityOptions[visibility]}</Text>
            <Text className="text-[32rpx] text-muted-foreground ml-[16rpx]">›</Text>
          </View>
        </Picker>
        <View className="h-[2rpx] bg-background mx-[-32rpx]" />
        <Input
          className="text-[28rpx] text-foreground pt-[24rpx]"
          placeholder={t('study.publish.tagsPlaceholder')}
          value={tags}
          onInput={(e) => setTags(e.detail.value)}
        />
      </View>

      <Button className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] h-[88rpx] leading-[88rpx] bg-primary text-foreground rounded-[44rpx] text-[30rpx]" loading={saving} onClick={submit} disabled={saving}>
        {t('study.publish.submit')}
      </Button>
    </View>
  )
}
