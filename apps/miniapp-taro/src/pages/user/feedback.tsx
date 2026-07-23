import { logger } from '@/utils/logger'
import { View, Text, Input, Button, Textarea, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { submitFeedback } from '@/api'
import { uploadPictures } from '@/utils/upload-image'
import { useI18n } from '@/i18n'

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
    <View className="min-h-screen bg-background">
      <View className="mx-[12px] mt-[12px] px-[16px] py-[16px] bg-card rounded-[8px]">
        <Text className="block text-[14px] text-foreground mb-[12px]">{tt('feedback.type', '类型')}</Text>
        <View className="flex flex-wrap gap-[8px]">
          {types.map((item) => (
            <View
              key={item.key}
              className={`px-[16px] py-[6px] rounded-[16px] text-[13px] ${
                activeType === item.key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              }`}
              onClick={() => setActiveType(item.key)}
            >
              <Text>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View className="mx-[12px] mt-[12px] px-[16px] py-[16px] bg-card rounded-[8px]">
        <View className="flex items-center justify-between mb-[12px]">
          <Text className="text-[14px] text-foreground">{tt('feedback.content', '内容')}</Text>
          <Text className="text-[12px] text-muted-foreground">{content.length}/{MAX_CONTENT}</Text>
        </View>
        <Textarea
          className="w-full text-[14px] min-h-[120px]"
          placeholder={tt('feedback.contentPlaceholder', '请输入反馈详情')}
          value={content}
          onInput={(e) => setContent(e.detail.value)}
          maxlength={MAX_CONTENT}
        />
      </View>
      <View className="mx-[12px] mt-[12px] px-[16px] py-[16px] bg-card rounded-[8px]">
        <Text className="block text-[14px] text-foreground mb-[12px]">
          {tt('feedback.images', `图片(最多${MAX_IMAGES}张)`)}
        </Text>
        <View className="flex flex-wrap gap-[8px]">
          {images.map((url, idx) => (
            <View
              key={url + idx}
              className="relative w-[72px] h-[72px] rounded-[6px] overflow-hidden"
              onClick={() => onPreviewImage(idx)}
            >
              <Image className="w-full h-full" src={url} mode="aspectFill" />
              <View
                className="absolute top-0 right-0 w-[20px] h-[20px] bg-[rgba(0,0,0,0.6)] rounded-md flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation && e.stopPropagation()
                  onRemoveImage(idx)
                }}
              >
                <Text className="text-white text-[12px] leading-none">×</Text>
              </View>
            </View>
          ))}
          {images.length < MAX_IMAGES && (
            <View
              className="w-[72px] h-[72px] rounded-[6px] bg-muted flex items-center justify-center"
              onClick={onPickImages}
            >
              <Text className="text-[24px] text-muted-foreground leading-none">
                {uploading ? '...' : '+'}
              </Text>
            </View>
          )}
        </View>
        {uploading && (
          <Text className="block text-[12px] text-muted-foreground mt-[8px]">{tt('feedback.uploading', '上传中')}</Text>
        )}
      </View>
      <View className="mx-[12px] mt-[12px] px-[16px] py-[16px] bg-card rounded-[8px]">
        <Text className="block text-[14px] text-foreground mb-[12px]">{tt('feedback.contact', '联系方式')}</Text>
        <Input
          className="w-full text-[14px]"
          type="text"
          placeholder={tt('feedback.contactPlaceholder', '请输入联系方式(选填)')}
          value={contact}
          onInput={(e) => setContact(e.detail.value)}
        />
      </View>
      <Button
        className={`mx-[16px] mt-[30px] rounded-[20px] text-[16px] ${
          content.trim() ? 'bg-primary text-white' : 'bg-[#ccc] text-white'
        }`}
        disabled={!content.trim()}
        onClick={onSubmit}
      >
        {tt('feedback.submit', '提交反馈')}
      </Button>
    </View>
  )
}
