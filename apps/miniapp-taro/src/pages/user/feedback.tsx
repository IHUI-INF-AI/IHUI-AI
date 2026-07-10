import { View, Text, Input, Button, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { submitFeedback } from '@/api'

const types = ['投诉', '建议', 'bug', '其他']

export default function Feedback() {
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [activeType, setActiveType] = useState('建议')

  async function onSubmit() {
    if (!content.trim()) {
      return Taro.showToast({ title: '请输入反馈内容', icon: 'none' })
    }
    try {
      await submitFeedback({ content: content.trim(), contact: contact.trim() || undefined })
      Taro.showToast({ title: '提交成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch {}
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] mt-[12px] px-[16px] py-[16px] bg-white rounded-[8px]">
        <Text className="block text-[14px] text-[#333] mb-[12px]">反馈类型</Text>
        <View className="flex flex-wrap gap-[8px]">
          {types.map(t => (
            <View
              key={t}
              className={`px-[16px] py-[6px] rounded-[16px] text-[13px] ${
                activeType === t ? 'bg-[#007aff] text-white' : 'bg-[#f5f5f5] text-[#666]'
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
          onInput={e => setContent(e.detail.value)}
          maxlength={500}
        />
      </View>
      <View className="mx-[12px] mt-[12px] px-[16px] py-[16px] bg-white rounded-[8px]">
        <Text className="block text-[14px] text-[#333] mb-[12px]">联系方式（选填）</Text>
        <Input
          className="w-full text-[14px]"
          type="text"
          placeholder="请输入手机号或邮箱"
          value={contact}
          onInput={e => setContact(e.detail.value)}
        />
      </View>
      <Button
        className={`mx-[16px] mt-[30px] rounded-[20px] text-[16px] ${
          content.trim() ? 'bg-[#007aff] text-white' : 'bg-[#ccc] text-white'
        }`}
        disabled={!content.trim()}
        onClick={onSubmit}
      >
        提交反馈
      </Button>
    </View>
  )
}
