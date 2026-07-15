import { View, Text, Input, Button, Textarea, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { submitFeedback } from '@/api'
import { uploadPictures } from '@/utils/upload-image'

const MAX_IMAGES = 3
const types = ['投诉', '建议', 'bug', '其他']

export default function Feedback() {
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [activeType, setActiveType] = useState('建议')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  async function onPickImages() {
    if (uploading || images.length >= MAX_IMAGES) return
    setUploading(true)
    try {
      const results = await uploadPictures(MAX_IMAGES - images.length)
      const urls = results.map((r) => r.url).filter(Boolean)
      if (urls.length) setImages((prev) => [...prev, ...urls].slice(0, MAX_IMAGES))
    } catch (e) {
      console.error('[user/feedback] 上传图片 failed:', e)
      Taro.showToast({ title: '图片上传失败', icon: 'none' })
    } finally {
      setUploading(false)
    }
  }

  function onRemoveImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx))
  }

  async function onSubmit() {
    if (!content.trim()) {
      return Taro.showToast({ title: '请输入反馈内容', icon: 'none' })
    }
    try {
      await submitFeedback({
        content: content.trim(),
        contact: contact.trim() || undefined,
        images: images.length ? images : undefined,
      })
      Taro.showToast({ title: '提交成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      console.error('[user/feedback] 提交反馈 failed:', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] mt-[12px] px-[16px] py-[16px] bg-white rounded-[8px]">
        <Text className="block text-[14px] text-[#333] mb-[12px]">反馈类型</Text>
        <View className="flex flex-wrap gap-[8px]">
          {types.map((t) => (
            <View
              key={t}
              className={`px-[16px] py-[6px] rounded-[16px] text-[13px] ${
                activeType === t ? 'bg-[#07c160] text-white' : 'bg-[#f5f5f5] text-[#666]'
              }`}
              onClick={() => setActiveType(t)}
            >
              <Text>{t}</Text>
            </View>
          ))}
        </View>
      </View>
      <View className="mx-[12px] mt-[12px] px-[16px] py-[16px] bg-white rounded-[8px]">
        <Text className="block text-[14px] text-[#333] mb-[12px]">反馈内容</Text>
        <Textarea
          className="w-full text-[14px] min-h-[120px]"
          placeholder="请输入反馈内容"
          value={content}
          onInput={(e) => setContent(e.detail.value)}
          maxlength={500}
        />
      </View>
      <View className="mx-[12px] mt-[12px] px-[16px] py-[16px] bg-white rounded-[8px]">
        <Text className="block text-[14px] text-[#333] mb-[12px]">
          图片（选填，最多{MAX_IMAGES}张）
        </Text>
        <View className="flex flex-wrap gap-[8px]">
          {images.map((url, idx) => (
            <View
              key={url + idx}
              className="relative w-[72px] h-[72px] rounded-[6px] overflow-hidden"
            >
              <Image className="w-full h-full" src={url} mode="aspectFill" />
              <View
                className="absolute top-0 right-0 w-[20px] h-[20px] bg-[rgba(0,0,0,0.6)] rounded-full flex items-center justify-center"
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
        {uploading && <Text className="block text-[12px] text-[#999] mt-[8px]">上传中...</Text>}
      </View>
      <View className="mx-[12px] mt-[12px] px-[16px] py-[16px] bg-white rounded-[8px]">
        <Text className="block text-[14px] text-[#333] mb-[12px]">联系方式（选填）</Text>
        <Input
          className="w-full text-[14px]"
          type="text"
          placeholder="请输入手机号或邮箱"
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
        提交反馈
      </Button>
    </View>
  )
}
