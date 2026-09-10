// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Input, Button, Textarea, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { submitFeedback } from '@/api'
import { uploadPictures } from '@/utils/upload-image'
import ThemeRoot from '@/components/ThemeRoot'

const MAX_IMAGES = 3
const MAX_CONTENT = 500

export default function Feedback() {
  const { t } = useI18n()
  // 本地 fallback:feedback 命名空间待主 agent 补 i18n key,未命中时返回 fb 保证页面可用
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [activeType, setActiveType] = useState('suggestion')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const types = [
    { key: 'complaint', label: tt('feedback.types.complaint', '投诉') },
    { key: 'suggestion', label: tt('feedback.types.suggestion', '建议') },
    { key: 'bug', label: tt('feedback.types.bug', 'Bug') },
    { key: 'other', label: tt('feedback.types.other', '其他') },
  ]

  const onPickImages = useCallback(async () => {
    if (uploading || images.length >= MAX_IMAGES) return
    setUploading(true)
    try {
      const results = await uploadPictures(MAX_IMAGES - images.length)
      const urls = results.map((r) => r.url).filter(Boolean)
      if (urls.length) setImages((prev) => [...prev, ...urls].slice(0, MAX_IMAGES))
    } catch (e) {
      logger.error('user/feedback', '上传图片', e)
      Taro.showToast({ title: tt('feedback.uploadFailed', '上传失败'), icon: 'none' })
    } finally {
      setUploading(false)
    }
  }, [uploading, images.length, tt])

  const onRemoveImage = useCallback((idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  // 预览大图:对标原项目 fankui/index.vue 点击图片查看
  const onPreviewImage = useCallback(
    (idx: number) => {
      if (!images.length) return
      Taro.previewImage({ current: images[idx], urls: images })
    },
    [images],
  )

  const onSubmit = useCallback(async () => {
    if (!content.trim()) {
      return Taro.showToast({ title: tt('feedback.enterContent', '请输入反馈内容'), icon: 'none' })
    }
    try {
      await submitFeedback({
        content: content.trim(),
        contact: contact.trim() || undefined,
        images: images.length ? images : undefined,
      })
      Taro.showToast({ title: tt('feedback.submitSuccess', '反馈成功'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('user/feedback', '提交反馈', e)
      Taro.showToast({ title: tt('common.failed', '操作失败'), icon: 'none' })
    }
  }, [content, contact, images, tt])

  return (
    <ThemeRoot>
      {/* 对齐 RN 共享 FeedbackScreen:页面浅灰底 + 单张白卡(描边 border.light + 圆角 24rpx +
          内边距 28rpx);label 28rpx 次级字色;类型药丸 muted 底/激活品牌橙;textarea 188rpx;
          缩略图 70dp→140rpx/圆角 16rpx;提交钮品牌橙 100rpx 高圆角 24rpx */}
      <View className="min-h-screen bg-background">
        <View className="p-[28rpx]">
          <View className="rounded-[24rpx] border border-[var(--color-border)] bg-card p-[28rpx]">
            <Text className="block text-[28rpx] text-muted-foreground">
              {tt('feedback.type', '类型')}
            </Text>
            <View className="mt-[16rpx] flex flex-wrap gap-[16rpx]">
              {types.map((item) => (
                <View
                  key={item.key}
                  className={`px-[24rpx] py-[12rpx] rounded-[24rpx] text-[28rpx] ${
                    activeType === item.key
                      ? 'bg-[var(--color-brand-orange)] text-[var(--color-surface-light)]'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  hoverClass="opacity-60"
                  onClick={() => setActiveType(item.key)}
                >
                  <Text>{item.label}</Text>
                </View>
              ))}
            </View>

            <Text className="mt-[16rpx] block text-[28rpx] text-muted-foreground">
              {tt('feedback.content', '内容')}
            </Text>
            <Textarea
              className="mt-[16rpx] box-border w-full min-h-[188rpx] rounded-[24rpx] bg-muted p-[24rpx] text-[28rpx] text-foreground"
              placeholder={tt('feedback.contentPlaceholder', '请输入反馈详情')}
              value={content}
              onInput={(e) => setContent(e.detail.value)}
              maxlength={MAX_CONTENT}
            />

            <Text className="mt-[16rpx] block text-[28rpx] text-muted-foreground">
              {tt('feedback.contact', '联系方式')}
            </Text>
            <Input
              className="mt-[16rpx] box-border h-[100rpx] w-full rounded-[24rpx] bg-muted px-[24rpx] text-[28rpx] text-foreground"
              type="text"
              placeholder={tt('feedback.contactPlaceholder', '请输入联系方式(选填)')}
              value={contact}
              onInput={(e) => setContact(e.detail.value)}
            />

            <Text className="mt-[16rpx] block text-[28rpx] text-muted-foreground">
              {tt('feedback.images', `图片(最多${MAX_IMAGES}张)`)}
            </Text>
            <View className="mt-[16rpx] flex flex-wrap gap-[16rpx]">
              {images.map((url, idx) => (
                <View
                  key={url + idx}
                  className="relative h-[140rpx] w-[140rpx] overflow-hidden rounded-[16rpx] bg-muted"
                  hoverClass="opacity-60"
                  onClick={() => onPreviewImage(idx)}
                >
                  <Image className="h-full w-full" src={url} mode="aspectFill" />
                  <View
                    className="absolute right-0 top-0 flex h-[40rpx] w-[40rpx] items-center justify-center rounded-md bg-[var(--color-black-40)] dark:bg-[var(--color-black-60)]"
                    hoverClass="opacity-60"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveImage(idx)
                    }}
                  >
                    <Text className="text-[28rpx] leading-none text-[var(--color-surface-light)]">
                      ×
                    </Text>
                  </View>
                </View>
              ))}
              {images.length < MAX_IMAGES && (
                <View
                  className="flex h-[140rpx] w-[140rpx] items-center justify-center rounded-[16rpx] border border-dashed border-[var(--color-border)]"
                  hoverClass="opacity-60"
                  onClick={onPickImages}
                >
                  <Text className="text-[48rpx] leading-none text-[var(--color-text-tertiary)]">
                    {uploading ? '...' : '+'}
                  </Text>
                </View>
              )}
            </View>
            {uploading && (
              <Text className="mt-[16rpx] block text-[24rpx] text-muted-foreground">
                {tt('feedback.uploading', '上传中')}
              </Text>
            )}

            <Button
              className={`mt-[24rpx] flex h-[100rpx] items-center justify-center rounded-[24rpx] bg-[var(--color-brand-orange)] text-[28rpx] font-semibold text-[var(--color-surface-light)] ${
                content.trim() ? '' : 'opacity-60'
              }`}
              disabled={!content.trim()}
              onClick={onSubmit}
            >
              {tt('feedback.submit', '提交反馈')}
            </Button>
          </View>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
