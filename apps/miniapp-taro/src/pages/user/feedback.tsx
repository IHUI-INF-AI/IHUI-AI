import { View, Text, Input, Textarea, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { submitFeedback } from '@/api'

const types = ['功能建议', '问题反馈', '体验问题', '其他']

export default function Feedback() {
  const [type, setType] = useState('功能建议')
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')

  async function onSubmit() {
    if (content.length < 10) {
      return Taro.showToast({ title: '至少输入10字', icon: 'none' })
    }
    try {
      await submitFeedback({ content: `[${type}]${content}`, contact })
      Taro.showToast({ title: '提交成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch (e) {}
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa] pb-[60px]">
      <View className="mx-[12px] px-[16px] py-[16px] bg-white rounded-[8px]">
        <Text className="block text-[13px] text-[#333] my-[8px]">反馈类型</Text>
        <View className="flex flex-wrap gap-[8px]">
          {types.map(t => (
            <Text
              key={t}
              className={`px-[12px] py-[6px] border-[1px] border-solid rounded-[12px] text-[12px] ${
                type === t
                  ? 'border-[#007aff] text-[#007aff] bg-[#e6f0ff]'
                  : 'border-[#eee] text-[#666]'
              }`}
              onClick={() => setType(t)}
            >
              {t}
            </Text>
          ))}
        </View>

        <Text className="block text-[13px] text-[#333] my-[8px]">反馈内容</Text>
        <Textarea
          className="w-full min-h-[120px] p-[10px] bg-[#f7f8fa] rounded-[6px] text-[14px] box-border"
          placeholder="请详细描述您遇到的问题或建议（10-500字）"
          maxlength={500}
          value={content}
          onInput={e => setContent(e.detail.value)}
        />
        <Text className="block text-right text-[11px] text-[#999] mt-[4px]">{content.length}/500</Text>

        <Text className="block text-[13px] text-[#333] my-[8px]">联系方式（可选）</Text>
        <Input
          className="w-full p-[10px] bg-[#f7f8fa] rounded-[6px] text-[14px] box-border"
          placeholder="手机号/邮箱，方便我们联系您"
          value={contact}
          onInput={e => setContact(e.detail.value)}
        />
      </View>
      <Button
        className={`mx-[16px] mt-[16px] rounded-[20px] text-[16px] ${
          content.length >= 10 ? 'bg-[#007aff] text-white' : 'bg-[#ccc] text-white'
        }`}
        disabled={content.length < 10}
        onClick={onSubmit}
      >
        提交反馈
      </Button>
    </View>
  )
}
