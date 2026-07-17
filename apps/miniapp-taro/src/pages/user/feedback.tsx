import { logger } from '@/utils/logger'
import { View, Text, Input, Button, Textarea, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { submitFeedback } from '@/api'
import { uploadPictures } from '@/utils/upload-image'
import { useI18n } from '@/i18n'

const MAX_IMAGES = 3

export default function Feedback() {
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [activeType, setActiveType] = useState('suggestion')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const types = [
    { key: 'complaint', label: t('feedback.types.complaint') },
    { key: 'suggestion', label: t('feedback.types.suggestion') },
    { key: 'bug', label: t('feedback.types.bug') },
    { key: 'other', label: t('feedback.types.other') },
  ]

  async function onPickImages() {
    if (uploading || images.length >= MAX_IMAGES) return
    setUploading(true)
    try {
      const results = await uploadPictures(MAX_IMAGES - images.length)
      const urls = results.map((r) => r.url).filter(Boolean)
      if (urls.length) setImages((prev) => [...prev, ...urls].slice(0, MAX_IMAGES))
    } catch (e) {
      logger.error('user/feedback', '上传图片', e)
      Taro.showToast({ title: t('feedback.uploadFailed'), icon: 'none' })
    } finally {
      setUploading(false)
    }
  }

  function onRemoveImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx))
  }

  async function onSubmit() {
    if (!content.trim()) {
      return Taro.showToast({ title: t('feedback.enterContent'), icon: 'none' })
    }
    try {
      await submitFeedback({
        content: content.trim(),
        contact: contact.trim() || undefined,
        images: images.length ? images : undefined,
      })
      Taro.showToast({ title: t('feedback.submitSuccess'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('user/feedback', '提交反馈', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] mt-[12px] px-[16px] py-[16px] bg-white rounded-[8px]">
        <Text className="block text-[14px] text-[#333] mb-[12px]">{t('feedback.type')}</Text>
        <View className="flex flex-wrap gap-[8px]">
          {types.map((item) => (
            <View
              key={item.key}
              className={`px-[16px] py-[6px] rounded-[16px] text-[13px] ${
                activeType === item.key ? 'bg-[#07c160] text-white' : 'bg-[#f5f5f5] text-[#666]'
              }`}
              onClick={() => setActiveType(item.key)}
            >
              <Text>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View className="mx-[12px] mt-[12px] px-[16px] py-[16px] bg-white rounded-[8px]">
        <Text className="block text-[14px] text-[#333] mb-[12px]">{t('feedback.content')}</Text>
        <Textarea
          className="w-full text-[14px] min-h-[120px]"
          placeholder={t('feedback.contentPlaceholder')}
          value={content}
          onInput={(e) => setContent(e.detail.value)}
          maxlength={500}
        />
      </View>
      <View className="mx-[12px] mt-[12px] px-[16px] py-[16px] bg-white rounded-[8px]">
        <Text className="block text-[14px] text-[#333] mb-[12px]">
          {t('feedback.images', { n: MAX_IMAGES })}
        </Text>
        <View className="flex flex-wrap gap-[8px]">
          {images.map((url, idx) => (
            <View
              key={url + idx}
              className="relative w-[72px] h-[72px] rounded-[6px] overflow-hidden"
            >
              <Image className="w-full h-full" src={url} mode="aspectFill" />
              <View
                className="absolute top-0 right-0 w-[20px] h-[20px] bg-[rgba(0,0,0,0.6)] rounded-md flex items-center justify-center"
                onClick={() => onRemoveImage(idx)}
              >
                <Text className="text-white text-[12px] leading-none">×</Text>
              </View>
            </View>
          ))}
          {images.length < MAX_IMAGES && (
            <View
              className="w-[72px] h-[72px] rounded-[6px] bg-[#f5f5f5] flex items-center justify-center"
              onClick={onPickImages}
            >
              <Text className="text-[24px] text-[#999] leading-none">
                {uploading ? '...' : '+'}
              </Text>
            </View>
          )}
        </View>
        {uploading && (
          <Text className="block text-[12px] text-[#999] mt-[8px]">{t('feedback.uploading')}</Text>
        )}
      </View>
      <View className="mx-[12px] mt-[12px] px-[16px] py-[16px] bg-white rounded-[8px]">
        <Text className="block text-[14px] text-[#333] mb-[12px]">{t('feedback.contact')}</Text>
        <Input
          className="w-full text-[14px]"
          type="text"
          placeholder={t('feedback.contactPlaceholder')}
          value={contact}
          onInput={(e) => setContact(e.detail.value)}
        />
      </View>
      <Button
        className={`mx-[16px] mt-[30px] rounded-[20px] text-[16px] ${
          content.trim() ? 'bg-[#07c160] text-white' : 'bg-[#ccc] text-white'
        }`}
        disabled={!content.trim()}
        onClick={onSubmit}
      >
        {t('feedback.submit')}
      </Button>
    </View>
  )
}
