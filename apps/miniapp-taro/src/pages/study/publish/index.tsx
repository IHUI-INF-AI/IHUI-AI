// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, Input, Textarea, Button, Picker } from '@tarojs/components'
import { logger } from '@/utils/logger'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { post } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

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
    <ThemeRoot>
      {/* 对齐 RN StudyPublishScreen(共享屏):字段直接铺在 surface.bg 上(无白卡包裹),表单 content p14dp→28rpx / gap14dp→28rpx;
          input 语言:border light / radius 12dp→24rpx / h 50dp→100rpx / px 12dp→24rpx / bg surface.muted / 字号 16dp→32rpx;提交按钮 h 50dp→100rpx / radius 15dp→30rpx */}
      <View className="min-h-screen bg-background px-[28rpx] pt-[28rpx] pb-[180rpx] flex flex-col gap-[28rpx]">
        <Input
          className="h-[100rpx] px-[24rpx] py-[20rpx] bg-muted border border-border rounded-[24rpx] text-[32rpx] text-foreground"
          placeholder={t('study.publish.titlePlaceholder')}
          maxlength={50}
          value={title}
          onInput={(e) => setTitle(e.detail.value)}
        />

        <View className="flex flex-col gap-[12rpx]">
          <Textarea
            className="w-full min-h-[160rpx] px-[24rpx] py-[20rpx] bg-muted border border-border rounded-[24rpx] text-[32rpx] text-foreground"
            placeholder={t('study.publish.contentPlaceholder')}
            maxlength={2000}
            value={content}
            onInput={(e) => setContent(e.detail.value)}
          />
          <Text className="block text-right text-[22rpx] text-[var(--color-text-tertiary)]">
            {content.length}/2000
          </Text>
        </View>

        {/* 分类/可见范围/标签为业务字段(RN 端为赛道/阶段 chip),统一套用 RN input 字段视觉 */}
        <View className="flex flex-col gap-[16rpx]">
          <Picker
            mode="selector"
            range={categories}
            value={category}
            onChange={(e) => setCategory(Number(e.detail.value))}
          >
            <View className="flex items-center h-[100rpx] px-[24rpx] bg-muted border border-border rounded-[24rpx]">
              <Text className="text-[28rpx] text-foreground w-[160rpx]">
                {t('study.publish.category')}
              </Text>
              <Text className="flex-1 text-[28rpx] text-muted-foreground text-right">
                {categories[category]}
              </Text>
              <Text className="text-[32rpx] text-muted-foreground ml-[16rpx]">›</Text>
            </View>
          </Picker>
          <Picker
            mode="selector"
            range={visibilityOptions}
            value={visibility}
            onChange={(e) => setVisibility(Number(e.detail.value))}
          >
            <View className="flex items-center h-[100rpx] px-[24rpx] bg-muted border border-border rounded-[24rpx]">
              <Text className="text-[28rpx] text-foreground w-[160rpx]">
                {t('study.publish.visibility')}
              </Text>
              <Text className="flex-1 text-[28rpx] text-muted-foreground text-right">
                {visibilityOptions[visibility]}
              </Text>
              <Text className="text-[32rpx] text-muted-foreground ml-[16rpx]">›</Text>
            </View>
          </Picker>
          <Input
            className="h-[100rpx] px-[24rpx] bg-muted border border-border rounded-[24rpx] text-[28rpx] text-foreground"
            placeholder={t('study.publish.tagsPlaceholder')}
            value={tags}
            onInput={(e) => setTags(e.detail.value)}
          />
        </View>

        <Button
          className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] h-[100rpx] leading-[100rpx] bg-primary text-primary-foreground rounded-[30rpx] text-[32rpx] font-semibold text-center"
          loading={saving}
          onClick={submit}
          disabled={saving}
        >
          {t('study.publish.submit')}
        </Button>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
